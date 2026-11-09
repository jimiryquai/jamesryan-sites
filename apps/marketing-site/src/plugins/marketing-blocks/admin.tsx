import React, { useEffect, useState } from "react";
import { apiFetch, API_BASE, parseApiResponse } from "@emdash-cms/admin";

interface ServiceOption {
	id: string;
	name: string;
	value: string;
	label: string;
}

interface ServiceSelectProps {
	value?: string;
	onChange: (value?: string) => void;
	label: string;
	id: string;
	required?: boolean;
	minimal?: boolean;
}

export function ServiceSelect({ value, onChange, label, id, required, minimal }: ServiceSelectProps) {
	const [options, setOptions] = useState<ServiceOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		async function fetchOptions() {
			try {
				const response = await apiFetch(`${API_BASE}/plugins/marketing-blocks/services`);
				const data = await parseApiResponse<{ items: ServiceOption[] }>(response, "Failed to load services");
				if (active) {
					setOptions(data.items || []);
					setError(null);
				}
			} catch (err: any) {
				if (active) {
					setError(err.message || "Failed to fetch services");
				}
			} finally {
				if (active) {
					setLoading(false);
				}
			}
		}
		fetchOptions();
		return () => {
			active = false;
		};
	}, []);

	const containerClass = minimal ? "" : "flex flex-col gap-1.5 w-full";
	const labelClass = minimal ? "text-xs font-normal opacity-50" : "text-sm font-medium text-olive-700 dark:text-olive-300";
	const selectClass = "w-full rounded-md border border-olive-300 bg-white px-3 py-2 text-sm text-olive-900 focus:border-olive-500 focus:outline-none focus:ring-1 focus:ring-olive-500 dark:border-olive-700 dark:bg-olive-900 dark:text-olive-100 disabled:opacity-50";

	return (
		<div className={containerClass}>
			{!minimal && (
				<label htmlFor={id} className={labelClass}>
					{label}
					{required && <span className="text-red-500 ml-0.5">*</span>}
				</label>
			)}
			{loading ? (
				<select id={id} className={selectClass} disabled>
					<option>Loading services...</option>
				</select>
			) : error ? (
				<div className="text-xs text-red-500">Error: {error}</div>
			) : (
				<select
					id={id}
					value={value || ""}
					onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value || undefined)}
					className={selectClass}
					required={required}
				>
					<option value="">-- Select a Service --</option>
					{options.map((opt: ServiceOption) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			)}
		</div>
	);
}

export const fields = {
	"service-select": ServiceSelect,
};
