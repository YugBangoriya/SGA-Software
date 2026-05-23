// src/components/ui/StatusBadge.jsx

const STATUS_MAP = {
  paid:           { label: "Paid",             cls: "sg-badge-paid"    },
  partially_paid: { label: "Partially Paid",   cls: "sg-badge-partial" },
  unpaid:         { label: "Unpaid",            cls: "sg-badge-unpaid"  },
  emi:            { label: "EMI",              cls: "sg-badge-emi"     },
  loan:           { label: "Loan",             cls: "sg-badge-emi"     },
  pending:        { label: "Pending Approval", cls: "sg-badge-pending" },
  approved:       { label: "Approved",         cls: "sg-badge-paid"    },
  active:         { label: "Active",           cls: "sg-badge-paid"    },
  blocked:        { label: "Blocked",          cls: "sg-badge-unpaid"  },
  superadmin:     { label: "SuperAdmin",       cls: "sg-badge-pending" },
  owner:          { label: "Owner",            cls: "sg-badge-emi"     },
  employee:       { label: "Employee",         cls: "sg-badge-partial" },
};

export default function StatusBadge({ status, customLabel }) {
  const config = STATUS_MAP[status?.toLowerCase()] || {
    label: customLabel || status || "Unknown",
    cls:   "sg-badge-partial",
  };

  return (
    <span className={`sg-badge ${config.cls}`}>
      {customLabel || config.label}
    </span>
  );
}
