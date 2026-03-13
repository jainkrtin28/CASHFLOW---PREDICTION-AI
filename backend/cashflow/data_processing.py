import pandas as pd
import numpy as np


def _load_csv(path: str) -> pd.DataFrame:
    for enc in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            df = pd.read_csv(path, encoding=enc)
            break
        except UnicodeDecodeError:
            continue
    df.columns = [
        ''.join(ch for ch in col if ch.isprintable() and ord(ch) < 128).strip().upper()
        for col in df.columns
    ]
    return df


def build_features(series: pd.Series, full_dates: pd.DatetimeIndex) -> pd.DataFrame:
    """Build rich feature set for a daily time series (inflow or outflow)."""
    cf = pd.DataFrame({'date': full_dates, 'val': series.values})
    cf['day']          = np.arange(len(cf))
    cf['month']        = cf['date'].dt.month
    cf['weekday']      = cf['date'].dt.dayofweek
    cf['year']         = cf['date'].dt.year
    cf['quarter']      = cf['date'].dt.quarter
    cf['day_of_month'] = cf['date'].dt.day
    cf['is_month_end']   = cf['date'].dt.is_month_end.astype(int)
    cf['is_month_start'] = cf['date'].dt.is_month_start.astype(int)
    cf['is_mid_month']   = (cf['date'].dt.day == 15).astype(int)

    for lag in [1, 2, 3, 7, 14, 30]:
        cf[f'lag_{lag}'] = cf['val'].shift(lag).fillna(0)

    cf['rolling_avg_7']  = cf['val'].rolling(7,  min_periods=1).mean()
    cf['rolling_avg_14'] = cf['val'].rolling(14, min_periods=1).mean()
    cf['rolling_avg_30'] = cf['val'].rolling(30, min_periods=1).mean()
    cf['rolling_std_7']  = cf['val'].rolling(7,  min_periods=1).std().fillna(0)
    cf['rolling_std_30'] = cf['val'].rolling(30, min_periods=1).std().fillna(0)

    # Seasonal baselines — average value for this month / weekday
    cf['month_avg']   = cf.groupby('month')['val'].transform('mean')
    cf['weekday_avg'] = cf.groupby('weekday')['val'].transform('mean')

    return cf


FEATURES = [
    'day', 'month', 'weekday', 'year', 'quarter', 'day_of_month',
    'is_month_end', 'is_month_start', 'is_mid_month',
    'lag_1', 'lag_2', 'lag_3', 'lag_7', 'lag_14', 'lag_30',
    'rolling_avg_7', 'rolling_avg_14', 'rolling_avg_30',
    'rolling_std_7', 'rolling_std_30',
    'month_avg', 'weekday_avg'
]


def prepare_data(path: str) -> pd.DataFrame:
    df = _load_csv(path)
    df['DATE']     = pd.to_datetime(df['DATE'])
    df['TYPE']     = df['TYPE'].str.strip()
    df['CATEGORY'] = df['CATEGORY'].str.strip()

    inflow_raw  = df[df['TYPE'].str.lower() == 'inflow'].groupby('DATE')['AMOUNT'].sum()
    outflow_raw = df[df['TYPE'].str.lower() == 'outflow'].groupby('DATE')['AMOUNT'].sum()

    full_dates = pd.date_range(
        min(inflow_raw.index.min(), outflow_raw.index.min()),
        max(inflow_raw.index.max(), outflow_raw.index.max()),
        freq='D'
    )

    inflow_daily  = inflow_raw.reindex(full_dates, fill_value=0)
    outflow_daily = outflow_raw.reindex(full_dates, fill_value=0)
    cashflow      = inflow_daily - outflow_daily

    # Build feature frames for both series
    in_feat  = build_features(inflow_daily,  full_dates)
    out_feat = build_features(outflow_daily, full_dates)

    # Combine into one df — model.py will split inflow/outflow features apart
    df_cash = pd.DataFrame({
        'date':     full_dates,
        'cashflow': cashflow.values,
        'inflow':   inflow_daily.values,
        'outflow':  outflow_daily.values,
    })

    # Add inflow features with in_ prefix
    for f in FEATURES:
        df_cash[f'in_{f}']  = in_feat[f].values
        df_cash[f'out_{f}'] = out_feat[f].values

    # Legacy aliases so any old code paths still work
    df_cash['day']          = in_feat['day'].values
    df_cash['month']        = in_feat['month'].values
    df_cash['weekday']      = in_feat['weekday'].values
    df_cash['year']         = in_feat['year'].values
    df_cash['quarter']      = in_feat['quarter'].values
    df_cash['day_of_year']  = full_dates.dayofyear
    df_cash['is_month_end']   = full_dates.is_month_end.astype(int)
    df_cash['is_month_start'] = full_dates.is_month_start.astype(int)
    df_cash['rolling_avg_7']  = in_feat['rolling_avg_7'].values
    df_cash['rolling_avg_30'] = in_feat['rolling_avg_30'].values
    df_cash['rolling_std_7']  = in_feat['rolling_std_7'].values
    df_cash['lag_1'] = in_feat['lag_1'].values
    df_cash['lag_7'] = in_feat['lag_7'].values

    return df_cash


def get_category_breakdown(path: str) -> dict:
    df = _load_csv(path)
    df['TYPE']     = df['TYPE'].str.strip()
    df['CATEGORY'] = df['CATEGORY'].str.strip()

    inflow_by_cat = (
        df[df['TYPE'].str.lower() == 'inflow']
        .groupby('CATEGORY')['AMOUNT'].sum()
        .sort_values(ascending=False).head(10).to_dict()
    )
    outflow_by_cat = (
        df[df['TYPE'].str.lower() == 'outflow']
        .groupby('CATEGORY')['AMOUNT'].sum()
        .sort_values(ascending=False).head(10).to_dict()
    )
    return {'inflow_categories': inflow_by_cat, 'outflow_categories': outflow_by_cat}


def get_monthly_summary(df_cash: pd.DataFrame) -> list:
    df_cash = df_cash.copy()
    df_cash['year_month'] = df_cash['date'].dt.to_period('M')
    monthly = df_cash.groupby('year_month')['cashflow'].agg(
        total='sum', mean='mean', std='std', min='min', max='max'
    ).reset_index()
    monthly['year_month'] = monthly['year_month'].astype(str)
    monthly = monthly.fillna(0)
    return monthly.to_dict(orient='records')