import { LoanFormData } from "../../types/loan";

interface Props {
  form: LoanFormData;
  setForm: React.Dispatch<React.SetStateAction<LoanFormData>>;
}

export default function OverpaymentsInput({ form, setForm }: Props) {
  const { monthly, irregular } = form.overpayments;

  const formatter = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  });

  const handleMonthlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    setForm((prev) => ({
      ...prev,
      overpayments: { ...prev.overpayments, monthly: raw === "" ? null : Number(raw) },
    }));
  };

  const handleIrregularChange = (
    id: number,
    field: "date" | "amount",
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      overpayments: {
        ...prev.overpayments,
        irregular: prev.overpayments.irregular.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                [field]:
                  field === "amount"
                    ? value === "" ? null : Number(value.replace(/[^\d]/g, ""))
                    : value,
              }
            : entry
        ),
      },
    }));
  };

  const addIrregular = () => {
    setForm((prev) => ({
      ...prev,
      overpayments: {
        ...prev.overpayments,
        irregular: [
          ...prev.overpayments.irregular,
          { id: Date.now(), date: "", amount: null },
        ],
      },
    }));
  };

  const removeIrregular = (id: number) => {
    setForm((prev) => ({
      ...prev,
      overpayments: {
        ...prev.overpayments,
        irregular: prev.overpayments.irregular.filter((e) => e.id !== id),
      },
    }));
  };

  return (
    <div className="space-y-4 mt-6">
      <h2 className="text-lg font-semibold">Overpayment Information</h2>

      <div className="flex items-center space-x-4">
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            name="overpaymentMode"
            value="reduceTerm"
            checked={form.overpayments.mode === "reduceTerm"}
            onChange={() =>
              setForm({
                ...form,
                overpayments: { ...form.overpayments, mode: "reduceTerm" },
              })
            }
          />
          <span>Reduce Term</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="radio"
            name="overpaymentMode"
            value="reduceRepayment"
            checked={form.overpayments.mode === "reduceRepayment"}
            onChange={() =>
              setForm({
                ...form,
                overpayments: { ...form.overpayments, mode: "reduceRepayment" },
              })
            }
          />
          <span>Reduce Repayment</span>
        </label>
      </div>

      {/* Monthly */}
      <div className="flex items-center gap-2">
        <label className="w-1/4 font-medium">Monthly Overpayment</label>
        <input
          type="text"
          inputMode="numeric"
          value={monthly !== null ? formatter.format(monthly) : ""}
          onChange={handleMonthlyChange}
          placeholder="0"
          className="input-field"
          />
      </div>

      {/* Irregular */}
      <div>
        <label className="block font-bold mb-2">
          Irregular Overpayment
        </label>
        <div className="space-y-3">
          {irregular.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2">
              <input
                type="month"
                value={entry.date}
                onChange={(e) => handleIrregularChange(entry.id, "date", e.target.value)}
                className="input-field"              />
              
              <input
                type="text"
                inputMode="numeric"
                value={entry.amount !== null ? formatter.format(entry.amount) : ""}
                onChange={(e) => handleIrregularChange(entry.id, "amount", e.target.value)}
                placeholder="0"
                className="input-field"
              />
              <button
                type="button"
                onClick={() => removeIrregular(entry.id)}
                className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addIrregular}
          className="mt-3 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
        >
          + Add Overpayment
        </button>
      </div>
    </div>
  );
}
