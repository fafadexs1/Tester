
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
    options: { value: string; label: string }[];
    placeholder: string;
    searchPlaceholder: string;
    notFoundMessage: string;
    name: string; // Add name prop to be used for form submission
}

export function Combobox({ options, placeholder, searchPlaceholder, notFoundMessage, name }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedValues, setSelectedValues] = React.useState<string[]>([])

  const toggleSelection = (value: string) => {
    setSelectedValues(prev => 
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const displayLabel = selectedValues.length > 0 
    ? options
        .filter(opt => selectedValues.includes(opt.value))
        .map(opt => opt.label)
        .join(", ")
    : placeholder;

  return (
    <>
      {/* Hidden inputs to hold the selected values for form submission */}
      {selectedValues.map(value => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
                <CommandEmpty>{notFoundMessage}</CommandEmpty>
                <CommandGroup>
                {options.map((option) => (
                    <CommandItem
                    key={option.value}
                    value={option.label} // Search by label
                    onSelect={() => {
                        toggleSelection(option.value)
                    }}
                    >
                    <Check
                        className={cn(
                        "mr-2 h-4 w-4",
                        selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                        )}
                    />
                    {option.label}
                    </CommandItem>
                ))}
                </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}
