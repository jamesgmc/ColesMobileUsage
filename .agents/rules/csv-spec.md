# CSV Parsing Spec

## Sample Data Layout
The target CSV log (`samples\colesdata.csv`) format:
- **Row 1**: Metadata (e.g., `Report Generated: 29/05/2026      06:06:22 PM (AEST),,,,,,,`) - **Must be skipped.**
- **Row 2**: Headers - **Must be skipped or used as keys.**
- **Row 3+**: Data rows

### Explicit Column Names to Parse
- `Event`
- `To`
- `Date` (Format: MM/DD/YYYY)
- `Time`
- `Duration (Sec)`
- `Data Up (KB)`
- `Data Down (KB)`
- `Price`
