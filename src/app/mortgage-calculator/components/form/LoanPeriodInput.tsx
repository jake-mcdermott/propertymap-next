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
    <div className="flex flex-col gap-2">
      <label className="w-1/4 text-sm mt-4">{label}</label>
      <div>
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
        <span className="text-gray-400 text-md pl-2">Years</span>
      </div>

      <label className="w-1/4 text-sm mt-4">Interest Rate</label>
      <div>
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
        <span className="text-gray-400 text-md pl-2">%</span>
      </div>
    </div>
  );
}
