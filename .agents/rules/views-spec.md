# Views Spec

## Active State Framework
The application has three primary View Modes:
1. **Raw**: Full unaggregated list of all log entries.
2. **Daily**: Grouped and sorted strictly by day. Aggregates data usage, duration, etc. 
   - **Daily -> Event Drill-down Toggle**: Clicking any Day row expands a nested table showing all individual events for that day.
3. **Monthly**: Grouped by Month/Year (e.g., May 2026). 
   - **Monthly -> Daily Drill-down Toggle**: Clicking any Month row expands a nested table showing the Daily Breakdown.
   - **Daily -> Event Drill-down Toggle**: Inside the Daily Breakdown, clicking any Day row further expands to show all individual events for that day.
