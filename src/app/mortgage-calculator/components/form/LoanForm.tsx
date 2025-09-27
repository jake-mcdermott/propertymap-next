import { LoanFormData } from "../../types/loan";
import LoanAmountInput from "./LoanAmountInput";
import LoanTypeSelector from "./LoanTypeSelector";
import LoanPeriodInput from "./LoanPeriodInput";
import OverpaymentsInput from "./OverpaymentsInput";
import LoanStartDate from "./LoanStartDate"


interface Props {
    form: LoanFormData;
    setForm: React.Dispatch<React.SetStateAction<LoanFormData>>;
}

export default function LoanForm({ form, setForm }: Props) {

    return (
        <div>
            <h2 className="text-lg font-semibold">Loan Information</h2>
            <LoanAmountInput form={form} setForm={setForm} />
            {/* <LoanStartDate form={form} setForm={setForm} /> */}
            <LoanTypeSelector form={form} setForm={setForm} />

            {form.loanType === "fixed" && (
                <LoanPeriodInput type="fixed" label="Loan Period" form={form} setForm={setForm} />
            )}
            {form.loanType === "fixed and variable" && (
                <>
                    <LoanPeriodInput type="fixed" label="Period (Fixed)" form={form} setForm={setForm} />
                    <LoanPeriodInput type="variable" label="Period (Variable)" form={form} setForm={setForm} />
                </>
            )}

            {/* <OverpaymentsInput form={form} setForm={setForm} /> */}

        </div>

    );

}