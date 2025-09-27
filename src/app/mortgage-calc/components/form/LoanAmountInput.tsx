import { LoanFormData } from "../../types/loan";

interface Props {
  form: LoanFormData;
  setForm: React.Dispatch<React.SetStateAction<LoanFormData>>;
}

export default function LoanAmountInput({ form, setForm }: Props) {
  const formatter = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    setForm((prev) => ({
      ...prev,
      loanAmount: raw === "" ? null : Number(raw),
    }));
  };

  return (
    <div className="flex items-center gap-2 py-2">
      <label className="w-1/4 font-medium">Loan Amount</label>
      <input
        type="text"
        inputMode="numeric"
        value={form.loanAmount !== null ? formatter.format(form.loanAmount) : ""}
        onChange={handleChange}
        placeholder="0"
        className="input-field"
      />
    </div>
  );
}
