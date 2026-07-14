import * as React from "react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import "react-day-picker/dist/style.css"

import { cn } from "@/lib/utils"

export type CalendarProps = DayPickerProps

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-6", className)}
      classNames={{
        months: "flex flex-col gap-6 sm:flex-row sm:gap-10",
        month: "space-y-5",
        caption: "relative flex items-center justify-center pb-1",
        caption_label: "text-base font-semibold text-[#111217]",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous:
          "inline-flex h-9 w-9 items-center justify-center rounded text-[#111217] hover:bg-[#f4f4f5]",
        button_next:
          "inline-flex h-9 w-9 items-center justify-center rounded text-[#111217] hover:bg-[#f4f4f5]",
        month_grid: "w-full border-collapse",
        weekdays: "mb-1 flex",
        weekday: "w-8 text-center text-[12px] font-medium text-[#717171]",
        week: "mt-2 flex w-full",
        day: "h-8 w-8 p-0 text-center text-[16px]",
        day_button:
          "h-8 w-8 rounded text-[#17181c] transition-colors hover:bg-[#f2f2f3]",
        range_start: "[&>button]:bg-[#111217] [&>button]:text-white",
        range_end: "[&>button]:bg-[#111217] [&>button]:text-white",
        range_middle: "[&>button]:bg-[#ececef] [&>button]:text-[#17181c]",
        today: "[&>button]:font-semibold",
        outside: "[&>button]:text-[#727272]",
        selected: "[&>button]:bg-[#111217] [&>button]:text-white",
        ...classNames,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
