"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
  color?: string;
}

interface ColumnFilterProps {
  title: string;
  options: FilterOption[];
  selectedValues: string[];
  onFilterChange: (values: string[]) => void;
}

export function ColumnFilter({
  title,
  options,
  selectedValues,
  onFilterChange,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const hasActiveFilters = selectedValues.length > 0;

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onFilterChange(selectedValues.filter((v) => v !== value));
    } else {
      onFilterChange([...selectedValues, value]);
    }
  };

  const handleSelectAll = () => {
    onFilterChange(options.map((o) => o.value));
  };

  const handleClearAll = () => {
    onFilterChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 font-semibold px-2 -ml-2",
            hasActiveFilters
              ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
              : "hover:bg-gray-100"
          )}
        >
          {title}
          <Filter
            className={cn(
              "h-3.5 w-3.5",
              hasActiveFilters ? "text-blue-600" : "text-gray-400"
            )}
          />
          {hasActiveFilters && (
            <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-medium text-white">
              {selectedValues.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 bg-white border border-gray-200 shadow-lg" align="start">
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Filtra per {title}
            </span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
              >
                <X className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>
        <div className="p-2 max-h-64 overflow-y-auto">
          {/* Select All option */}
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer mb-1"
            onClick={
              selectedValues.length === options.length
                ? handleClearAll
                : handleSelectAll
            }
          >
            <Checkbox
              checked={selectedValues.length === options.length}
              className="border-gray-300"
            />
            <span className="text-sm font-medium text-gray-600">
              Seleziona tutti
            </span>
          </div>
          <div className="h-px bg-gray-100 my-1" />
          {/* Individual options */}
          {options.map((option) => (
            <div
              key={option.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
              onClick={() => handleToggle(option.value)}
            >
              <Checkbox
                checked={selectedValues.includes(option.value)}
                className="border-gray-300"
              />
              <div className="flex items-center gap-2 flex-1">
                {option.color && (
                  <span
                    className={cn("w-2 h-2 rounded-full", option.color)}
                  />
                )}
                <span className="text-sm text-gray-700">{option.label}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-gray-100 bg-gray-50">
          <Button
            size="sm"
            className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setOpen(false)}
          >
            Applica filtri
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
