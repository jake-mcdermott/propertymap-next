import { useState } from "react";

interface AmortizationTableProps {
  monthlyAmortizationData: {
    year: number;
    month: number;
    principal: number;
    interest: number;
    balance: number;
  }[];
  yearlyAmortizationData: {
    year: number;
    principal: number;
    interest: number;
    balance: number;
  }[];
}

function monthNumberToName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12");
  }
  return months[month - 1];
}

export default function AmortizationTable({
  monthlyAmortizationData,
  yearlyAmortizationData,
}: AmortizationTableProps) {
  const [selectedCadence, setSelectedCadence] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [page, setPage] = useState(0);
  const rowsPerPage = 12;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(value);

  const downloadCSV = () => {
    const rows =
      selectedCadence === "monthly"
        ? monthlyAmortizationData.map((row) => [
            row.year,
            row.month,
            row.principal,
            row.interest,
            row.balance,
          ])
        : yearlyAmortizationData.map((row) => [
            row.year,
            row.principal,
            row.interest,
            row.balance,
          ]);

    const headers =
      selectedCadence === "monthly"
        ? ["Year", "Month", "Principal", "Interest", "Ending Balance"]
        : ["Year", "Principal", "Interest", "Ending Balance"];

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `amortization-${selectedCadence}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-neutral-800/20 shadow-md p-6 md:rounded-lg rounded-none">
      {/* Toggle + Download */}
      <div className="flex justify-between items-center mb-4">
        <div className="inline-flex rounded-md border border-gray-600 overflow-hidden">
          <button
            className={`px-4 py-2 text-sm hover:cursor-pointer ${
              selectedCadence === "monthly"
                ? "bg-white text-black"
                : "bg-neutral-800 text-gray-300"
            }`}
            onClick={() => setSelectedCadence("monthly")}
          >
            Month View
          </button>
          <button
            className={`px-4 py-2 text-sm hover:cursor-pointer ${
              selectedCadence === "yearly"
                ? "bg-white text-black"
                : "bg-neutral-800 text-gray-300"
            }`}
            onClick={() => setSelectedCadence("yearly")}
          >
            Year View
          </button>
        </div>
        <button
          onClick={downloadCSV}
          className="px-3 py-2 text-sm rounded-md bg-green-600 hover:bg-green-700 text-white hover:cursor-pointer"
        >
          Download CSV
        </button>
      </div>

      {/* Table */}
      {selectedCadence === "monthly" ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead className="bg-neutral-800 text-gray-200">
              <tr>
                <th className="px-4 py-2">Year</th>
                <th className="px-4 py-2">Month</th>
                <th className="px-4 py-2">Principal</th>
                <th className="px-4 py-2">Interest</th>
                <th className="px-4 py-2">Ending Balance</th>
              </tr>
            </thead>
            <tbody>
              {monthlyAmortizationData
                .slice(page * rowsPerPage, (page + 1) * rowsPerPage)
                .map((row, idx) => (
                  <tr
                    key={idx}
                    className={
                      idx % 2 === 0 ? "bg-neutral-800" : "bg-neutral-900"
                    }
                  >
                    <td className="px-4 py-2">{row.year}</td>
                    <td className="px-4 py-2">{monthNumberToName(row.month)}</td>
                    <td className="px-4 py-2">{formatCurrency(row.principal)}</td>
                    <td className="px-4 py-2">{formatCurrency(row.interest)}</td>
                    <td className="px-4 py-2">{formatCurrency(row.balance)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {/* Pagination */}
          <div className="flex justify-between items-center mt-2 text-sm text-gray-400">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page {page + 1} of{" "}
              {Math.ceil(monthlyAmortizationData.length / rowsPerPage)}
            </span>
            <button
              disabled={(page + 1) * rowsPerPage >= monthlyAmortizationData.length}
              onClick={() =>
                setPage((p) =>
                  (p + 1) * rowsPerPage < monthlyAmortizationData.length
                    ? p + 1
                    : p
                )
              }
              className="px-2 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead className="bg-neutral-800 text-gray-200">
              <tr>
                <th className="px-4 py-2">Year</th>
                <th className="px-4 py-2">Principal</th>
                <th className="px-4 py-2">Interest</th>
                <th className="px-4 py-2">Ending Balance</th>
              </tr>
            </thead>
            <tbody>
              {yearlyAmortizationData.map((row, idx) => (
                <tr
                  key={idx}
                  className={
                    idx % 2 === 0 ? "bg-neutral-800" : "bg-neutral-900"
                  }
                >
                  <td className="px-4 py-2">{row.year}</td>
                  <td className="px-4 py-2">{formatCurrency(row.principal)}</td>
                  <td className="px-4 py-2">{formatCurrency(row.interest)}</td>
                  <td className="px-4 py-2">{formatCurrency(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
