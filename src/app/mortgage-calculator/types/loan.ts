export interface LoanFormData {
  loanAmount: number | null;
  loanType: "fixed" | "fixed and variable";
  fixed: {
    period: number | "";
    interest: number | "";
  };
  variable: {
    period: number | "";
    interest: number | "";
  };
  startDate: string;
  overpayments: {
    monthly: number | null;
    irregular: { id: number; date: string; amount: number | null }[];
    mode: "reduceTerm" | "reduceRepayment";
  };
}


export interface MonthlyData {
    year: number;
    month: number;
    principal: number;
    interest: number;
    balance: number;
}

export interface YearlyData {
    year: number;
    principal: number;
    interest: number;
    balance: number;
    cumulativeTotal: number;
}

export interface YearlyCumulativeData {
    year: number;
    principalPaid: number;
    interestPaid: number;
    currentBalance: number;
    cumulativeTotalPaid: number;
}

export interface ChartData {
    principalSeries: { x: number; y: number }[];
    interestSeries: { x: number; y: number }[];
    totalPaymentSeries: { x: number; y: number }[];
    yearlyAmortization: YearlyData[];
    monthlyAmortization: MonthlyData[];
    loanAmount: number;
    totalRepayment: number;
    totalInterest: number;
    yearlyCumulative: YearlyCumulativeData[];
}

export type OverpaymentMode = "reduceTerm" | "reduceRepayment";

