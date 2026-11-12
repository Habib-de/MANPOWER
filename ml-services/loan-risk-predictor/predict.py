# loan-risk-predictor/predict.py

import pandas as pd
import sys
import os

sys.path.append('..')

from model import LoanRiskPredictor

def predict_member_risk(member_id, members_df, loans_df):
    """Predict risk for a specific member"""
    risk_predictor = LoanRiskPredictor()
    risk_predictor.load_model()
    
    # Prepare features for all members
    features_df = risk_predictor.prepare_features(members_df, loans_df)
    
    # Find the specific member
    member_data = features_df[features_df['member_id'] == member_id]
    
    if len(member_data) == 0:
        print(f"❌ Member {member_id} not found")
        return None
    
    member_row = member_data.iloc[0]
    
    # Use DataFrame with feature names (SAME AS TRAINING)
    member_features = member_row[risk_predictor.feature_columns]
    
    # Make prediction
    prediction = risk_predictor.predict_risk(member_features)
    
    return prediction, member_row

def main():
    print("🛡️ LOAN RISK PREDICTOR - PREDICTION")
    print("==========================================")
    
    # Load data
    members_df = pd.read_csv('../data/members_ml_training.csv')
    loans_df = pd.read_csv('../data/loans_ml_training.csv')
    
    # Get some actual member IDs from the data
    actual_member_ids = members_df['id'].sample(5).tolist()  # Random 5 members
    
    print(f"🔍 Analyzing {len(actual_member_ids)} members...")
    
    for member_id in actual_member_ids:
        print(f"\n🔍 ANALYZING: {member_id}")
        print("-" * 40)
        
        result = predict_member_risk(member_id, members_df, loans_df)
        
        if result:
            prediction, member_data = result
            
            # Display member profile (USING ACTUAL DATABASE COLUMNS)
            print(f"📊 Member Profile:")
            print(f"   - Status: {member_data['status']}")
            print(f"   - Role: {member_data['role']}")
            print(f"   - Join Date: {member_data['joinDate']}")
            print(f"   - Membership Months: {member_data.get('membership_months', 'N/A'):.1f}")
            
            # Display loan history
            print(f"\n📈 Loan History:")
            print(f"   - Total Loans: {member_data.get('loan_count', 0)}")
            print(f"   - Avg Loan Amount: KES {member_data.get('avg_loan_amount', 0):,.0f}")
            print(f"   - Repayment Rate: {member_data.get('repayment_rate', 0)*100:.1f}%")
            print(f"   - Avg Outstanding: KES {member_data.get('avg_outstanding', 0):,.0f}")
            
            # Display prediction
            print(f"\n🎯 RISK ASSESSMENT:")
            print(f"   - Default Probability: {prediction['default_probability']}%")
            print(f"   - Risk Level: {prediction['emoji']} {prediction['risk_level']}")
            print(f"   - Recommendation: {prediction['recommendation']}")
            
            # Risk explanation based on ACTUAL features
            if prediction['risk_level'] in ["HIGH", "VERY HIGH"]:
                print("   🚨 HIGH RISK FACTORS:")
                if member_data.get('repayment_rate', 1) < 0.5:
                    print("     • Low repayment rate on previous loans")
                if member_data.get('avg_outstanding', 0) > member_data.get('avg_loan_amount', 1):
                    print("     • High outstanding debt relative to loan size")
                if member_data.get('loan_count', 0) > 3:
                    print("     • Multiple previous loans")
                    
            elif prediction['risk_level'] in ["LOW", "VERY LOW"]:
                print("   ✅ STRONG PROFILE FACTORS:")
                if member_data.get('repayment_rate', 0) >= 0.8:
                    print("     • Excellent repayment history")
                if member_data.get('membership_months', 0) > 12:
                    print("     • Long-term membership")
                if member_data['status'] == 'Active':
                    print("     • Active member status")
                    
            elif prediction['risk_level'] == "MEDIUM":
                print("   ⚠️  MODERATE RISK FACTORS:")
                if member_data.get('loan_count', 0) == 0:
                    print("     • No loan history (new member)")
                elif member_data.get('repayment_rate', 0) < 0.7:
                    print("     • Some repayment issues in past")

def predict_all_members():
    """Predict risk for all members and save to CSV"""
    print("\n📊 PREDICTING RISK FOR ALL MEMBERS...")
    print("==========================================")
    
    risk_predictor = LoanRiskPredictor()
    risk_predictor.load_model()
    
    # Load data
    members_df = pd.read_csv('../data/members_ml_training.csv')
    loans_df = pd.read_csv('../data/loans_ml_training.csv')
    
    # Prepare features for all members
    features_df = risk_predictor.prepare_features(members_df, loans_df)
    
    # Predict for all members
    predictions = []
    
    for _, member_row in features_df.iterrows():
        member_features = member_row[risk_predictor.feature_columns]
        prediction = risk_predictor.predict_risk(member_features)
        
        predictions.append({
            'member_id': member_row['member_id'],
            'default_probability': prediction['default_probability'],
            'risk_level': prediction['risk_level'],
            'recommendation': prediction['recommendation'],
            'membership_months': member_row.get('membership_months', 0),
            'loan_count': member_row.get('loan_count', 0),
            'repayment_rate': member_row.get('repayment_rate', 0),
            'status': member_row['status']
        })
    
    # Save results
    predictions_df = pd.DataFrame(predictions)
    predictions_df.to_csv('all_members_risk_predictions.csv', index=False)
    
    # Print summary
    risk_summary = predictions_df['risk_level'].value_counts()
    print(f"\n📈 RISK DISTRIBUTION SUMMARY:")
    print("=============================")
    for risk_level, count in risk_summary.items():
        percentage = (count / len(predictions_df)) * 100
        print(f"   {risk_level}: {count} members ({percentage:.1f}%)")
    
    print(f"\n💾 Full predictions saved to: all_members_risk_predictions.csv")
    return predictions_df

if __name__ == "__main__":
    # First, predict for sample members
    main()
    
    # Then, predict for all members
    all_predictions = predict_all_members()