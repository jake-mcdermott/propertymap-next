import { LoanFormData } from "../../types/loan";

interface Props {
  form: LoanFormData;
  setForm: React.Dispatch<React.SetStateAction<LoanFormData>>;
  type: "fixed" | "variable"; // tells us which branch to update
  label: string;
}

export default function LoanPeriodInput({ form, setForm, type, label }: Props) {
  const data = form[type];

  return (
    <div className="flex items-center gap-2 py-2">
      <label className="w-1/4 font-medium">{label}</label>
      <input
        type="number"
        min="1"
        max="40"
        value={data.period}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            [type]: { ...prev[type], period: e.target.value === "" ? "" : Number(e.target.value) },
          }))
        }
        className="input-field w-32 text-right"
      />
      <span className="text-gray-400 text-md pr-6">Years</span>
      <input
        type="number"
        step="0.01"
        value={data.interest}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            [type]: { ...prev[type], interest: e.target.value === "" ? "" : Number(e.target.value) },
          }))
        }
        className="input-field w-22 text-right"
        placeholder="2.5"
      />
      <span className="text-gray-400 text-md">% interest</span>
    </div>
  );
}
