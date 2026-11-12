# loan-risk-predictor/train.py - FINAL CORRECTED VERSION

import pandas as pd
import sys
import os

# Add parent directory to path to import modules
sys.path.append('..')

from model import LoanRiskPredictor

def main():
    print("🛡️ LOAN RISK PREDICTOR - TRAINING")
    print("==========================================")
    
    # Initialize model
    risk_predictor = LoanRiskPredictor()
    
    try:
        # Train model - let the model handle data loading internally
        print("📊 Starting training process...")
        test_accuracy, roc_auc = risk_predictor.train(save_model=True)
        
        print("\n🎉 TRAINING COMPLETED SUCCESSFULLY!")
        print("==========================================")
        print(f"📊 Final Model Performance:")
        print(f"   ✅ Test Accuracy: {test_accuracy:.4f}")
        print(f"   ✅ ROC-AUC Score: {roc_auc:.4f}")
        print("💾 Model saved to: models/risk_predictor.joblib")
        
        # Show sample predictions
        print("\n🔍 SAMPLE PREDICTIONS:")
        print("==========================================")
        
        # Load data for sample predictions
        members_df = pd.read_csv('../data/members_ml_training.csv')
        loans_df = pd.read_csv('../data/loans_ml_training.csv')
        
        # Prepare features for sample members
        features_df = risk_predictor.prepare_features(members_df, loans_df)
        sample_members = features_df.head(5)
        
        for _, member in sample_members.iterrows():
            # Use the correct prediction approach
            member_features = member[risk_predictor.feature_columns]
            prediction = risk_predictor.predict_risk(member_features)
            
            print(f"\n👤 Member: {member['member_id']}")
            print(f"   📊 Actual Risk: {'HIGH' if member['is_high_risk'] else 'LOW'}")
            print(f"   🎯 Predicted Default: {prediction['default_probability']}%")
            print(f"   ⚠️  Risk Level: {prediction['risk_level']}")
            print(f"   💡 Recommendation: {prediction['recommendation']} {prediction['emoji']}")
            
            # Show key features
            print(f"   📈 Key Factors:")
            print(f"      - Loan Count: {member.get('loan_count', 0)}")
            print(f"      - Repayment Rate: {member.get('repayment_rate', 0)*100:.1f}%")
            print(f"      - Membership: {member.get('membership_months', 0):.1f} months")
        
        print(f"\n🚀 Model is ready for predictions!")
        print("   Run: python predict.py")
        
    except Exception as e:
        print(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    main()