import {
  ChartData,
  LoanFormData,
  MonthlyData,
  YearlyData,
  YearlyCumulativeData
} from "../types/loan";

function calcMonthlyPayment(
  balance: number,
  monthlyRate: number,
  months: number
): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return balance / months;
  const r = monthlyRate;
  const denom = Math.pow(1 + r, months) - 1;
  if (denom === 0) return balance / months;
  return (balance * r * Math.pow(1 + r, months)) / denom;
}

export function createChartData(form: LoanFormData): ChartData {
  // Basic validation
  if (!form.loanAmount || form.loanAmount <= 0) {
    throw new Error("loanAmount must be provided and > 0");
  }

  // Determine periods & rates
  const fixedYears = Number(form.fixed.period) || 0;
  const variableYears = Number(form.variable.period) || 0;
  const fixedRate = Number(form.fixed.interest) || 0;
  const variableRate = Number(form.variable.interest) || 0;

  let totalYears = 0;
  if (form.loanType === "fixed") totalYears = fixedYears;
  else totalYears = fixedYears + variableYears; // both

  const totalMonths = Math.max(0, Math.round(totalYears * 12));
  if (totalMonths === 0) {
    throw new Error("Total loan period must be > 0 months");
  }

  const fixedMonths = fixedYears * 12;

  // initial monthly repayment: use the rate applicable in the first month
  const firstMonthlyRate = fixedRate / 12 / 100; // fixed OR start of 'both' uses fixed rate

  let monthlyRepayment = calcMonthlyPayment(
    form.loanAmount,
    firstMonthlyRate,
    totalMonths
  );

  // series + amortization containers
  const principalSeries: { x: number; y: number }[] = [{ x: 0, y: form.loanAmount }];
  const interestSeries: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  const totalPaymentSeries: { x: number; y: number }[] = [{ x: 0, y: 0 }];

  const yearlyAmortization: YearlyData[] = [];
  const monthlyAmortization: MonthlyData[] = [];
  const yearlyCumulative: YearlyCumulativeData[] = [];

  let remainingBalance = form.loanAmount;
  let yearInterest = 0;
  let yearPrincipal = 0;
  let cumulativeInterest = 0;
  let cumulativePayments = 0;
  let cumulativePrincipalPayments = 0;


  yearlyCumulative.push({
    year: 0,
    principalPaid: cumulativePrincipalPayments,
    interestPaid: cumulativeInterest,
    cumulativeTotalPaid: cumulativePayments,
    currentBalance: remainingBalance
  });

  // iterate months
  for (let i = 0; i < totalMonths; i++) {

    const currentMonth = (i % 12) + 1
    const currentYear = 1 + Math.floor(i / 12);

    // pick applicable monthly rate (handle 'both' switching)
    const currentMonthlyRate =
      form.loanType === "fixed" && i > fixedMonths
        ? variableRate / 12 / 100
        : form.loanType === "fixed and variable"
        ? variableRate / 12 / 100
        : fixedRate / 12 / 100;

    // if we've just moved into variable stage (for 'both'), recompute scheduled payment
    if (form.loanType === "fixed and variable" && i === fixedMonths + 1) {
      const monthsLeft = totalMonths - (i - 1);
      if (monthsLeft > 0) {
        monthlyRepayment = calcMonthlyPayment(remainingBalance, currentMonthlyRate, monthsLeft);
      }
    }

    // monthly interest on current balance
    const interest = remainingBalance * currentMonthlyRate;
    cumulativeInterest += interest;
    yearInterest += interest;

    // scheduled principal portion
    let principal = monthlyRepayment - interest;

    // if scheduled + overpayments would overpay the loan, clamp to remaining balance
    if (principal > remainingBalance) {
      principal = remainingBalance;
    }

    cumulativePrincipalPayments += principal

    const paymentThisMonth = interest + principal; // total actually paid this month
    cumulativePayments += paymentThisMonth;
    yearPrincipal += principal;
    remainingBalance -= principal;
    if (remainingBalance < 0) remainingBalance = 0;

    // push monthly amortization row
    monthlyAmortization.push({
      year: currentYear,
      month: currentMonth,
      principal: round2(principal),
      interest: round2(interest),
      balance: round2(remainingBalance),
    });

    // end-of-year or loan finished: push yearly aggregates + update series
    // const isYearEnd = ((loanStart.getMonth() + (i - 1)) % 12) === 11; // true when month index relative to start finishes a calendar year
    // simpler: treat each 12th payment after start as a "year" for the chart (year number = Math.ceil(i/12))
    // const yearIndex = Math.ceil(i / 12);

     const isEndOfYear = currentMonth === 12;
  const isLoanFinished = remainingBalance <= 0;

  if (isEndOfYear || isLoanFinished) {
    // if (i % 12 === 0 || remainingBalance <= 0) {
      // add series points at the year boundary (x = yearIndex)
      principalSeries.push({ x: currentYear, y: Math.max(0, remainingBalance) });
      interestSeries.push({ x: currentYear, y: cumulativeInterest });
      totalPaymentSeries.push({ x: currentYear, y: cumulativePayments });

      yearlyAmortization.push({
        year: currentYear,
        principal: round2(yearPrincipal),
        interest: round2(yearInterest),
        balance: round2(remainingBalance),
        cumulativeTotal: round2(cumulativePayments),
      });

      yearlyCumulative.push({
        year: currentYear,
        principalPaid: cumulativePrincipalPayments,
        interestPaid: cumulativeInterest,
        cumulativeTotalPaid: cumulativePayments,
        currentBalance: remainingBalance
      })

      // reset year aggregates
      yearInterest = 0;
      yearPrincipal = 0;
    }

    // if loan fully repaid, stop early
    if (remainingBalance <= 0) {
      break;
    }
  }

  const totalRepayment = round2(cumulativePayments);
  const totalInterest = round2(cumulativeInterest);
  const loanAmount = form.loanAmount

  return {
    principalSeries,
    interestSeries,
    totalPaymentSeries,
    yearlyAmortization,
    monthlyAmortization,
    loanAmount,
    totalRepayment,
    totalInterest,
    yearlyCumulative,
    monthlyRepayment,
  };
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}


// Todo
// 1. add start date, calculate from there on irregular payments
// 2.