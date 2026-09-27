# inspect_data.py
import pandas as pd
import os

def inspect_csv(filepath, max_rows=10, max_cols=20):
    """Safely inspect CSV file structure"""
    print(f"\n{'='*80}")
    print(f"📁 FILE: {filepath}")
    print(f"{'='*80}")
    
    try:
        # Read only first few rows
        df = pd.read_csv(filepath, nrows=max_rows)
        
        # Basic info
        print(f"\n📊 Shape: {df.shape[0]} rows (showing first {min(max_rows, df.shape[0])}), {df.shape[1]} columns")
        
        # Column names
        print(f"\n📋 COLUMNS ({len(df.columns)}):")
        for i, col in enumerate(df.columns):
            print(f"   {i+1:2}. {col}")
        
        # Data types
        print(f"\n🔤 DATA TYPES:")
        for col in df.columns[:max_cols]:
            print(f"   {col:25}: {df[col].dtype}")
        
        # Sample rows
        print(f"\n📝 FIRST {min(3, len(df))} ROWS:")
        print(df.head(3).to_string())
        
        # Check for nulls in first rows
        print(f"\n⚠️ NULL COUNTS (first {max_rows} rows):")
        null_counts = df.isnull().sum()
        null_cols = null_counts[null_counts > 0]
        if len(null_cols) > 0:
            for col, count in null_cols.items():
                print(f"   {col}: {count} nulls")
        else:
            print("   No nulls found in first rows")
        
        # Show unique values for categorical columns (first few)
        print(f"\n🏷️ UNIQUE VALUES (categorical columns, first 5 values):")
        for col in df.columns:
            if df[col].dtype == 'object' and len(df[col].unique()) <= 10:
                unique_vals = df[col].dropna().unique()
                print(f"   {col}: {list(unique_vals)[:5]}")
        
        return df
        
    except Exception as e:
        print(f"❌ Error reading {filepath}: {e}")
        return None

def main():
    """Main inspection function"""
    print("\n" + "="*80)
    print("🔍 LOAN ML SYSTEM DATA INSPECTION")
    print("="*80)
    
    # Paths to data files
    data_files = {
        'Members': '../data/members_ml_training.csv',
        'Contributions': '../data/contributions_ml_training.csv',
        'Loans': '../data/loans_ml_training.csv',
        'Member Comments': '../data/member_comments_ml_training.csv',
        'Notifications': '../data/notifications_ml_training.csv'
    }
    
    # Check current directory
    print(f"\n📂 Current working directory: {os.getcwd()}")
    
    # Check if data folder exists
    if os.path.exists('../data'):
        print(f"✅ Data folder found: {os.path.abspath('../data')}")
        print(f"📁 Contents: {os.listdir('../data')}")
    elif os.path.exists('data'):
        print(f"✅ Data folder found: {os.path.abspath('data')}")
        data_files = {k: f"data/{v.split('/')[-1]}" for k, v in data_files.items()}
    else:
        print(f"❌ Data folder not found. Looking for alternative paths...")
        
        # Try different paths
        possible_paths = ['./data/', '../data/', '../../data/']
        for path in possible_paths:
            if os.path.exists(path):
                print(f"✅ Found data at: {os.path.abspath(path)}")
                data_files = {k: f"{path}{v.split('/')[-1]}" for k, v in data_files.items()}
                break
    
    # Inspect each file
    data_dfs = {}
    for name, path in data_files.items():
        if os.path.exists(path):
            df = inspect_csv(path, max_rows=10)
            if df is not None:
                data_dfs[name] = df
        else:
            print(f"\n❌ File not found: {path}")
    
    # Summary
    print("\n" + "="*80)
    print("📊 SUMMARY")
    print("="*80)
    print(f"✅ Successfully loaded: {len(data_dfs)}/{len(data_files)} files")
    
    for name, df in data_dfs.items():
        print(f"   - {name}: {df.shape[1]} columns, {df.shape[0]} rows shown")
    
    print("\n💡 To see more rows, modify max_rows parameter in inspect_csv()")
    print("="*80)

if __name__ == "__main__":
    main()