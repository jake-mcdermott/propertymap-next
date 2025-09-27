import { LoanFormData } from "../../types/loan";

interface Props {
  form: LoanFormData;
  setForm: React.Dispatch<React.SetStateAction<LoanFormData>>;
}

export default function LoanStartDate({ form, setForm }: Props) {
  return (
    <div className="flex items-center gap-2 py-2">
      <label className="w-1/4 font-medium">Loan Start Date</label>
      <input
        type="month"
        value={form.startDate}
        onChange={(e) =>
            setForm((prev) => ({ ...prev, startDate: e.target.value }))
        }
        className="input-field"/>
    </div>
  );
}