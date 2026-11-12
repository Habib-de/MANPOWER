# train.py - UPDATED VERSION
import pandas as pd
import sys
import os

sys.path.append('..')

from model import SentimentAnalyzer

def main():
    print("📊 LOAN PURPOSE RISK ANALYZER - TRAINING")
    print("==========================================")
    
    # Initialize analyzer
    risk_analyzer = SentimentAnalyzer()
    
    try:
        # Train model
        accuracy = risk_analyzer.train(save_model=True)
        
        print("\n🎉 LOAN PURPOSE RISK TRAINING COMPLETED!")
        print("==========================================")
        print(f"📊 Final Model Performance:")
        print(f"   ✅ Test Accuracy: {accuracy:.4f}")
        print("💾 Model saved to: models/sentiment_analyzer.joblib")
        
        # Test predictions with the trained model
        print("\n🔍 TESTING PREDICTIONS WITH TRAINED MODEL:")
        print("==========================================")
        
        # Sample test purposes
        test_cases = [
            ("Buying dairy cows for milk production business", "Mobile App"),
            ("Medical emergency hospital bills urgent", "SMS"),
            ("School fees for university education", "Email"),
            ("Debt repayment to clear existing loans", "Meeting"),
            ("New stock for my supermarket business", "WhatsApp"),
        ]
        
        for purpose, channel in test_cases:
            try:
                prediction = risk_analyzer.predict_loan_purpose_risk(purpose, channel)
                print(f"\n📝 '{purpose[:50]}...'")
                print(f"   Channel: {channel}")
                print(f"   Risk: {prediction['risk_level']} ({prediction['confidence']}% confidence)")
                print(f"   Rule-Based: {prediction['rule_based_risk']}")
                print(f"   Match: {'✓' if prediction['model_vs_rule_match'] else '✗'}")
            except Exception as e:
                print(f"❌ Error predicting '{purpose[:30]}...': {e}")
        
        print(f"\n🚀 Loan Purpose Risk Analyzer is ready!")
        
    except Exception as e:
        print(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    main()