# CSM Book of Business — Dashboard

Streamlit replica of the Salesforce dashboard *CSM Book of Business — Retention and Expansion*. Reads Report 1 (Renewal + Expansion) from a linked Google Sheet.

See [DASHBOARD_SPEC.md](DASHBOARD_SPEC.md) for the full metric catalog, formulas, and widget mapping.

## Run locally

    pip install -r requirements.txt
    streamlit run app.py

The data source is configured in [data_loader.py](data_loader.py) (`SHEET_ID`, `GID`). The Sheet must be readable by anonymous fetch (publicly shared) or wired to gspread later.

## Files

- `app.py` — Streamlit page, widget layout, filters
- `data_loader.py` — Sheet → DataFrame, column renaming, numeric coercion
- `metrics.py` — 13 derived metrics + raw-field aggregations + grouping helper
- `DASHBOARD_SPEC.md` — source of truth for formulas
