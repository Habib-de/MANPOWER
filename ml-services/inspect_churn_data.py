# inspect_churn_data.py
import pandas as pd
import numpy as np
from datetime import datetime

print("=" * 60)
print("🔍 INSPECTING YOUR DATA FOR CHURN MODEL")
print("=" * 60)

# 1. Check Members Data
print("\n👥 MEMBERS DATA:")
members_df = pd.read_csv('data/members_ml_training.csv')
print(f"Shape: {members_df.shape}")
print(f"Columns: {list(members_df.columns)}")
print(f"Status distribution:\n{members_df['status'].value_counts()}")
print(f"Role distribution:\n{members_df['role'].value_counts()}")
print(f"Date range: {members_df['joinDate'].min()} to {members_df['joinDate'].max()}")

# 2. Check Contributions Data
print("\n💰 CONTRIBUTIONS DATA:")
contrib_df = pd.read_csv('data/contributions_ml_training.csv')
print(f"Shape: {contrib_df.shape}")
print(f"Columns: {list(contrib_df.columns)}")
print(f"Total contributions: KES {contrib_df['amount'].sum():,.0f}")
print(f"Date range: {contrib_df['transactionDate'].min()} to {contrib_df['transactionDate'].max()}")
print(f"Status distribution:\n{contrib_df['status'].value_counts()}")

# 3. Check Loans Data
print("\n🏦 LOANS DATA:")
loans_df = pd.read_csv('data/loans_ml_training.csv')
print(f"Shape: {loans_df.shape}")
print(f"Columns: {list(loans_df.columns)}")
print(f"Total loan volume: KES {loans_df['amount'].sum():,.0f}")
print(f"Status distribution:\n{loans_df['status'].value_counts()}")

# 4. Check Notifications (for engagement data)
print("\n📱 NOTIFICATIONS DATA:")
notif_df = pd.read_csv('data/member_comments_ml_training.csv')
print(f"Shape: {notif_df.shape}")
print(f"Columns: {list(notif_df.columns)}")

# 5. Check Existing Model Structure
print("\n🤖 EXISTING ELIGIBILITY MODEL:")
import joblib
model_path = 'loan-eligibility-predictor/models/loan_eligibility_model.joblib'
model_data = joblib.load(model_path)
print(f"Model type: {type(model_data['model']).__name__}")
print(f"Features used: {model_data.get('feature_names', ['Not found'])}")
print(f"Scaler: {type(model_data['scaler']).__name__}")

print("\n" + "=" * 60)
print("✅ INSPECTION COMPLETE")
print("=" * 60)