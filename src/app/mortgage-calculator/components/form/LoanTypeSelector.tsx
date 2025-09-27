import { LoanFormData } from "../../types/loan";

interface Props {
  form: LoanFormData;
  setForm: React.Dispatch<React.SetStateAction<LoanFormData>>;
}

export default function LoanTypeSelector({ form, setForm }: Props) {
  return (
    <div className="flex items-center gap-4 py-2">
      <label className="w-1/4 font-medium">Loan Type</label>
      <div className="flex-1 flex flex-row space-x-6">
        {["fixed", "fixed and variable"].map((type) => (
          <label key={type} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="loanType"
              value={type}
              checked={form.loanType === type}
              onChange={() =>
                setForm((prev) => ({ ...prev, loanType: type as LoanFormData["loanType"] }))
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="capitalize">{type}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
