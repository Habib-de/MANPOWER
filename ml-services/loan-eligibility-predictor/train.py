# loan-eligibility-predictor/train.py
from model import LoanEligibilityPredictor
import sys
import os
import numpy as np  # ADD THIS IMPORT

# Add parent directory to path to import from data folder
sys.path.append('..')

def main():
    print("🚀 Starting Loan Eligibility Model Training...")
    print("=" * 50)
    
    # Initialize and train the model
    predictor = LoanEligibilityPredictor()
    
    try:
        print("📦 Loading data...")
        train_score, test_score = predictor.train(save_model=True)
        
        print("\n🎉 TRAINING COMPLETED SUCCESSFULLY!")
        print("=" * 50)
        print(f"📊 Final Model Performance:")
        print(f"   ✅ Training R²: {train_score:.4f}")
        print(f"   ✅ Test R²: {test_score:.4f}")
        print("💾 Model saved to: models/loan_eligibility_model.joblib")
        
        # Show what the model can predict
        print("\n🔮 Model Ready for Predictions!")
        print("   Run: python predict.py")
        print("   Run: python predict_all.py (for all 2000 members)")
        
    except Exception as e:
        print(f"❌ Training failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    main()