"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { useStatistics } from "@/hooks/useStatistics";

interface MetricRow {
  metric: string;
  value: string;
  status: "good" | "warning" | "critical";
  description: string;
}

export default function MetricsTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const { status } = useSystemStatus();
  const { stats } = useStatistics();

  const data = useMemo<MetricRow[]>(() => {
    const sniffer = status?.sniffer;
    const triage = status?.triage;
    const llm = status?.llm_analyzer;
    const counts = stats?.counts;
    
    const qSize = status?.queues?.packet_queue_size ?? 0;
    const qMax = status?.queues?.packet_queue_max ?? 1;
    const qFill = qMax > 0 ? (qSize / qMax) * 100 : 0;
    
    // Calculate total analyzed packets
    const analyzed = llm?.analyzed_count ?? 0;
    const flagged = triage?.packets_flagged ?? 0;
    const triageRatio = flagged > 0 ? (analyzed / flagged) * 100 : 0;

    return [
      {
        metric: "Total Alerts",
        value: counts?.total?.toLocaleString() ?? "0",
        status: (counts?.critical ?? 0) > 0 ? "critical" : (counts?.high ?? 0) > 0 ? "warning" : "good",
        description: "Total threats detected across all sessions",
      },
      {
        metric: "Triage Success",
        value: `${triageRatio.toFixed(1)}%`,
        status: triageRatio < 50 ? "warning" : "good",
        description: "Flagged packets successfully analyzed by AI",
      },
      {
        metric: "LLM Pipeline",
        value: `${llm?.analyzed_count?.toLocaleString() ?? "0"} analyzed`,
        status: (llm?.error_count ?? 0) > 5 ? "critical" : "good",
        description: `Errors: ${llm?.error_count ?? 0}`,
      },
      {
        metric: "Queue Latency",
        value: `${qFill.toFixed(1)}%`,
        status: qFill > 80 ? "critical" : qFill > 50 ? "warning" : "good",
        description: `${qSize} / ${qMax} packets enqueued`,
      },
      {
        metric: "Triage Rate",
        value: triage?.packets_flagged?.toLocaleString() ?? "0",
        status: "good",
        description: "Packets flagged by heuristic engine",
      },
      {
        metric: "Database",
        value: status?.database?.connected ? "Connected" : "Offline",
        status: status?.database?.connected ? "good" : "critical",
        description: status?.database?.path ?? "sqlite3",
      },
    ];
  }, [status, stats]);

  const statusColor = {
    good: "#00ff88",
    warning: "#ffd700",
    critical: "#ff3366",
  };

  const columns = useMemo<ColumnDef<MetricRow>[]>(
    () => [
      {
        accessorKey: "metric",
        header: "Metric",
        cell: ({ row }) => (
          <span
            style={{ fontFamily: "var(--font-orbitron, monospace)" }}
            className="text-sm font-semibold text-slate-200"
          >
            {row.original.metric}
          </span>
        ),
      },
      {
        accessorKey: "value",
        header: "Value",
        cell: ({ row }) => (
          <span
            className="text-sm font-bold"
            style={{ color: statusColor[row.original.status] }}
          >
            {row.original.value}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status;
          return (
            <span
              className={
                s === "critical"
                  ? "badge-critical"
                  : s === "warning"
                  ? "badge-medium"
                  : "badge-low"
              }
            >
              {s === "critical" ? "⚠ Critical" : s === "warning" ? "! Warning" : "✓ Normal"}
            </span>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-xs text-slate-500">{row.original.description}</span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-5 border-b border-cyan-900/30">
        <h3
          className="text-sm font-bold text-cyan-400 uppercase tracking-widest"
          style={{ fontFamily: "var(--font-orbitron, monospace)" }}
        >
          Performance Metrics
        </h3>
        <p className="text-xs text-slate-500 mt-1">Live system telemetry — click headers to sort</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-cyan-900/20">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wider select-none"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-slate-600">
                          {header.column.getIsSorted() === "asc" ? (
                            <ChevronUp size={12} />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronsUpDown size={12} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="table-row-hover border-b border-transparent transition-all"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-5 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
