# predict_all.py
from model import LoanEligibilityPredictor
import pandas as pd
import numpy as np
import sys
import os

sys.path.append('..')

def predict_all_members():
    """Predict loan eligibility for ALL 2000 members"""
    predictor = LoanEligibilityPredictor()
    
    try:
        # Load ALL data
        members = pd.read_csv('../data/members_ml_training.csv')
        contributions = pd.read_csv('../data/contributions_ml_training.csv')
        loans = pd.read_csv('../data/loans_ml_training.csv')
        
        print("🎯 Predicting loan eligibility for ALL 2000 members...")
        results = predictor.predict(members, contributions, loans)
        
        print(f"✅ Completed predictions for {len(results)} members")
        
        # Comprehensive statistics
        amounts = [r['eligible_amount'] for r in results]
        
        print("\n📊 COMPREHENSIVE RESULTS:")
        print("=" * 60)
        print(f"   📈 Average Eligibility: KES {np.mean(amounts):,.0f}")
        print(f"   📉 Minimum Eligibility: KES {min(amounts):,.0f}")
        print(f"   📈 Maximum Eligibility: KES {max(amounts):,.0f}")
        print(f"   📊 Median Eligibility:  KES {np.median(amounts):,.0f}")
        print(f"   📋 Standard Deviation:  KES {np.std(amounts):,.0f}")
        print("=" * 60)
        
        # Show distribution
        print("\n📈 Eligibility Distribution:")
        bins = [0, 10000, 25000, 50000, 100000, 200000, 500000]
        labels = ['<10K', '10-25K', '25-50K', '50-100K', '100-200K', '200K+']
        
        for i in range(len(bins)-1):
            count = len([a for a in amounts if bins[i] <= a < bins[i+1]])
            percentage = (count / len(amounts)) * 100
            print(f"   {labels[i]}: {count} members ({percentage:.1f}%)")
        
        # Save results to CSV
        results_df = pd.DataFrame(results)
        results_df.to_csv('all_members_eligibility.csv', index=False)
        print(f"\n💾 Full results saved to: all_members_eligibility.csv")
        
        return results
        
    except Exception as e:
        print(f"❌ Prediction failed: {e}")
        return None

if __name__ == "__main__":
    predict_all_members()