# loan-eligibility-predictor/evaluate.py
from model import LoanEligibilityPredictor
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import sys
import os

sys.path.append('..')

def evaluate_model_performance():
    """Comprehensive model performance evaluation"""
    print("📊 Evaluating Model Performance...")
    print("=" * 60)
    
    predictor = LoanEligibilityPredictor()
    
    try:
        # Load data
        members, contributions, loans = predictor.load_data()
        X, member_ids = predictor.prepare_features(members, contributions, loans)
        y_true = predictor.calculate_eligibility_labels(members, contributions, loans)
        
        # Load the trained model properly
        predictor.load_model()  # This will load the fitted scaler
        
        # Make predictions using the model's predict method (which handles scaling)
        results = predictor.predict(members, contributions, loans)
        y_pred = np.array([r['eligible_amount'] for r in results])
        
        # Calculate metrics
        mae = mean_absolute_error(y_true, y_pred)
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        r2 = r2_score(y_true, y_pred)
        
        # Calculate accuracy within different tolerance levels
        tolerance_10pct = np.mean(np.abs(y_true - y_pred) <= y_true * 0.10) * 100
        tolerance_20pct = np.mean(np.abs(y_true - y_pred) <= y_true * 0.20) * 100
        tolerance_kes_5000 = np.mean(np.abs(y_true - y_pred) <= 5000) * 100
        tolerance_kes_10000 = np.mean(np.abs(y_true - y_pred) <= 10000) * 100
        
        print("🎯 PREDICTION ACCURACY METRICS:")
        print("=" * 60)
        print(f"📊 R² Score: {r2:.4f}")
        print(f"📊 Mean Absolute Error: KES {mae:,.0f}")
        print(f"📊 Root Mean Squared Error: KES {rmse:,.0f}")
        print(f"📊 Mean Squared Error: KES {mse:,.0f}")
        print("\n🎯 ACCURACY WITHIN TOLERANCE:")
        print(f"✅ Within 10% of actual: {tolerance_10pct:.1f}% of predictions")
        print(f"✅ Within 20% of actual: {tolerance_20pct:.1f}% of predictions")
        print(f"✅ Within KES 5,000: {tolerance_kes_5000:.1f}% of predictions")
        print(f"✅ Within KES 10,000: {tolerance_kes_10000:.1f}% of predictions")
        
        # Feature Importance
        feature_importance = predictor.model.feature_importances_
        feature_names = predictor.feature_names
        
        print("\n🔍 FEATURE IMPORTANCE:")
        print("=" * 60)
        for name, importance in sorted(zip(feature_names, feature_importance), 
                                      key=lambda x: x[1], reverse=True):
            print(f"   {name:25}: {importance:.4f}")
        
        # Prediction vs Actual Analysis
        print("\n📈 PREDICTION VS ACTUAL ANALYSIS:")
        print("=" * 60)
        print(f"   Actual Avg Eligibility:    KES {y_true.mean():,.0f}")
        print(f"   Predicted Avg Eligibility: KES {y_pred.mean():,.0f}")
        print(f"   Actual Min-Max:            KES {y_true.min():,.0f} - KES {y_true.max():,.0f}")
        print(f"   Predicted Min-Max:         KES {y_pred.min():,.0f} - KES {y_pred.max():,.0f}")
        
        # Error distribution
        errors = y_pred - y_true
        print(f"\n📊 ERROR DISTRIBUTION:")
        print(f"   Mean Error:          KES {errors.mean():,.0f}")
        print(f"   Std Dev of Errors:   KES {errors.std():,.0f}")
        print(f"   Max Overestimation:  KES {errors.max():,.0f}")
        print(f"   Max Underestimation: KES {errors.min():,.0f}")
        
        # Business Impact Analysis
        print("\n💼 BUSINESS IMPACT ANALYSIS:")
        print("=" * 60)
        
        # Count conservative vs aggressive predictions
        conservative = np.sum(y_pred < y_true)  # Under-predicting
        aggressive = np.sum(y_pred > y_true)    # Over-predicting
        exact = np.sum(y_pred == y_true)        # Exact matches
        
        print(f"   Conservative predictions (safe):    {conservative} members ({conservative/len(y_true)*100:.1f}%)")
        print(f"   Aggressive predictions (risky):     {aggressive} members ({aggressive/len(y_true)*100:.1f}%)")
        print(f"   Exact predictions:                  {exact} members ({exact/len(y_true)*100:.1f}%)")
        
        # Risk categories based on prediction errors
        high_risk = np.sum(np.abs(errors) > 50000)  # Errors > KES 50,000
        medium_risk = np.sum((np.abs(errors) > 20000) & (np.abs(errors) <= 50000))
        low_risk = np.sum(np.abs(errors) <= 20000)
        
        print(f"\n🚨 RISK CATEGORIES:")
        print(f"   High Risk (> KES 50K error):  {high_risk} members")
        print(f"   Medium Risk (KES 20-50K error): {medium_risk} members")
        print(f"   Low Risk (< KES 20K error):   {low_risk} members")
        
        # Performance rating
        print(f"\n🏆 MODEL PERFORMANCE RATING:")
        print("=" * 60)
        if r2 > 0.9:
            rating = "EXCELLENT 🎉"
        elif r2 > 0.8:
            rating = "VERY GOOD ✅"
        elif r2 > 0.7:
            rating = "GOOD 👍"
        elif r2 > 0.6:
            rating = "FAIR ⚠️"
        else:
            rating = "NEEDS IMPROVEMENT ❌"
            
        print(f"   Overall Rating: {rating} (R² = {r2:.4f})")
        
        return {
            'r2_score': r2,
            'mae': mae,
            'rmse': rmse,
            'tolerance_10pct': tolerance_10pct,
            'tolerance_20pct': tolerance_20pct,
            'feature_importance': dict(zip(feature_names, feature_importance))
        }
        
    except Exception as e:
        print(f"❌ Evaluation failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def show_sample_predictions():
    """Show sample predictions vs actual for verification"""
    print("\n🔍 SAMPLE PREDICTIONS VERIFICATION:")
    print("=" * 60)
    
    predictor = LoanEligibilityPredictor()
    
    try:
        # Load data
        members, contributions, loans = predictor.load_data()
        
        # Take first 10 members for sample verification
        sample_members = members.head(10)
        
        # Calculate actual eligibility
        actual_eligibility = predictor.calculate_eligibility_labels(sample_members, contributions, loans)
        
        # Get predictions
        predictions = predictor.predict(sample_members, contributions, loans)
        
        print("Member ID         | Actual      | Predicted   | Difference")
        print("-" * 55)
        
        for i, (member_id, actual) in enumerate(zip(sample_members['id'], actual_eligibility)):
            predicted = predictions[i]['eligible_amount']
            difference = predicted - actual
            
            print(f"{member_id:15} | KES {actual:7,.0f} | KES {predicted:7,.0f} | KES {difference:7,.0f}")
            
    except Exception as e:
        print(f"❌ Sample verification failed: {e}")

if __name__ == "__main__":
    print("🤖 LOAN ELIGIBILITY MODEL - COMPREHENSIVE EVALUATION")
    print("=" * 60)
    
    # Run comprehensive evaluation
    results = evaluate_model_performance()
    
    # Show sample predictions
    show_sample_predictions()
    
    print("\n🎉 EVALUATION COMPLETED!")
    print("💡 Interpretation:")
    print("   - R² > 0.8: Excellent | 0.6-0.8: Good | <0.6: Needs improvement")
    print("   - MAE: Average prediction error in KES")
    print("   - Tolerance: % of predictions within acceptable error range")