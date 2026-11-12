import os
import sys
import pandas as pd
import joblib
import numpy as np
from typing import Dict, Any, List

# --- Ensure parent-level modules are discoverable ---
base_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(base_dir, ".."))
sys.path.append(project_root)

# --- Import models using direct module imports ---
eligibility_model_path = os.path.join(project_root, "loan-eligibility-predictor", "model.py")
risk_model_path = os.path.join(project_root, "loan-risk-predictor", "model.py")
sentiment_model_path = os.path.join(project_root, "sentiment-analyzer", "model.py")

# Import using importlib for more control
import importlib.util

def load_module(module_path, module_name):
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

# Load the modules
eligibility_module = load_module(eligibility_model_path, "loan_eligibility_model")
risk_module = load_module(risk_model_path, "loan_risk_model") 
sentiment_module = load_module(sentiment_model_path, "sentiment_analyzer_model")

# Get the classes
LoanEligibilityPredictor = eligibility_module.LoanEligibilityPredictor
LoanRiskPredictor = risk_module.LoanRiskPredictor
SentimentAnalyzer = sentiment_module.SentimentAnalyzer


def main():
    print("\n🤖 ORCHESTRATOR - ML SERVICE HUB WITH CONFIDENCE SCORES")
    print("========================================================")

    # --- Data paths ---
    members_path = os.path.join(project_root, "data", "members_ml_training.csv")
    loans_path = os.path.join(project_root, "data", "loans_ml_training.csv")
    comments_path = os.path.join(project_root, "data", "member_comments_ml_training.csv")
    contributions_path = os.path.join(project_root, "data", "contributions_ml_training.csv")

    # --- Load data ---
    print("📂 Loading data...")
    try:
        members_df = pd.read_csv(members_path)
        loans_df = pd.read_csv(loans_path)
        comments_df = pd.read_csv(comments_path)
        contributions_df = pd.read_csv(contributions_path)
        print(f"✅ Loaded: {len(members_df)} members, {len(loans_df)} loans, {len(comments_df)} comments, {len(contributions_df)} contributions")
    except Exception as e:
        print(f"❌ Error loading data: {e}")
        return

    # --- Initialize models ---
    print("🧠 Initializing models...")
    eligibility_model = LoanEligibilityPredictor()
    risk_model = LoanRiskPredictor()
    sentiment_model = SentimentAnalyzer()

    # --- Load pre-trained models ---
    print("📂 Loading trained models...")
    
    # Load eligibility model
    try:
        # Change to eligibility directory to load model
        original_dir = os.getcwd()
        os.chdir(os.path.join(project_root, "loan-eligibility-predictor"))
        eligibility_model.load_model()  # Uses the hardcoded path in the model
        os.chdir(original_dir)
        print("✅ Eligibility model loaded successfully!")
    except Exception as e:
        print(f"❌ Eligibility model failed: {e}")
        # Try direct joblib load as fallback
        try:
            eligibility_model_path = os.path.join(project_root, "loan-eligibility-predictor", "models", "loan_eligibility_model.joblib")
            model_data = joblib.load(eligibility_model_path)
            eligibility_model.model = model_data['model']
            eligibility_model.scaler = model_data['scaler']
            eligibility_model.feature_names = model_data['feature_names']
            eligibility_model.is_trained = True
            print("✅ Eligibility model loaded via direct joblib!")
        except Exception as e2:
            print(f"❌ Eligibility model completely failed: {e2}")
            return

    # Load risk model
    try:
        risk_model_path = os.path.join(project_root, "loan-risk-predictor", "models", "risk_predictor.joblib")
        risk_model.load_model(risk_model_path)
        print("✅ Risk model loaded successfully!")
    except Exception as e:
        print(f"❌ Risk model failed: {e}")
        return

    # Load sentiment model
    try:
        sentiment_model_path = os.path.join(project_root, "sentiment-analyzer", "models", "sentiment_analyzer.joblib")
        sentiment_model.load_model(sentiment_model_path)
        print("✅ Sentiment model loaded successfully!")
    except Exception as e:
        print(f"❌ Sentiment model failed: {e}")
        return

    # --- Select members to analyze ---
    members_to_check = members_df["id"].unique()[:5]  # limit for testing
    results = []

    print("\n🚀 Running integrated predictions with confidence scores...\n")

    for member_id in members_to_check:
        print(f"----------------------------------------")
        print(f"🔍 Analyzing member {member_id} ...")

        # Initialize confidence components
        confidence_components = {
            'eligibility_confidence': 0.0,
            'risk_confidence': 0.0, 
            'sentiment_confidence': 0.0,
            'final_confidence': 0.0
        }

        # 1️⃣ Loan Eligibility with Confidence
        eligibility_amount = 0
        eligibility_confidence = 0.0
        try:
            # Use the model's predict method
            eligibility_results = eligibility_model.predict(members_df, contributions_df, loans_df)
            for result in eligibility_results:
                if result['member_id'] == member_id:
                    eligibility_amount = result['eligible_amount']
                    eligibility_confidence = calculate_eligibility_confidence(eligibility_amount, members_df, member_id)
                    break
            print(f"💰 Eligibility: KES {eligibility_amount:,.0f} (Confidence: {eligibility_confidence:.1%})")
        except Exception as e:
            print(f"⚠️  Eligibility model failed: {e}")
            eligibility_confidence = 0.3
            eligibility_amount = 10000  # Default minimum

        confidence_components['eligibility_confidence'] = eligibility_confidence

        # 2️⃣ Loan Risk with Confidence
        risk_label = "Unknown"
        risk_confidence = 0.0
        risk_probability = 0.0
        try:
            # Prepare features and predict
            features_df = risk_model.prepare_features(members_df, loans_df)
            member_features = features_df[features_df['member_id'] == member_id]
            
            if not member_features.empty:
                # Get the member's feature row
                member_row = member_features.iloc[0]
                member_feature_vector = member_row[risk_model.feature_columns]
                
                # Predict risk
                risk_prediction = risk_model.predict_risk(member_feature_vector)
                risk_label = risk_prediction['risk_level']
                risk_probability = risk_prediction['default_probability'] / 100  # Convert to 0-1
                risk_confidence = calculate_risk_confidence(risk_label, risk_probability)
                
            print(f"🛡️ Loan Risk: {risk_label} (Probability: {risk_probability:.1%}, Confidence: {risk_confidence:.1%})")
        except Exception as e:
            print(f"⚠️  Risk model failed: {e}")
            risk_confidence = 0.3
            risk_label = "MEDIUM"

        confidence_components['risk_confidence'] = risk_confidence

        # 3️⃣ Sentiment Analysis with Confidence
        sentiment_risk = "Unknown"
        sentiment_confidence = 0.0
        try:
            sentiment_result = sentiment_model.analyze_member_sentiment(member_id)
            sentiment_risk = sentiment_result.get('overall_risk_indicator', 'Unknown')
            sentiment_confidence = calculate_sentiment_confidence(sentiment_result)
            print(f"🧠 Sentiment Risk: {sentiment_risk} (Confidence: {sentiment_confidence:.1%})")
        except Exception as e:
            print(f"⚠️  Sentiment model failed: {e}")
            sentiment_confidence = 0.2
            sentiment_risk = "LOW"

        confidence_components['sentiment_confidence'] = sentiment_confidence

        # ✅ Combine results with overall confidence
        final_recommendation, final_confidence, decision_reasoning = compute_final_recommendation_with_confidence(
            eligibility_amount, risk_label, risk_probability, sentiment_risk, confidence_components
        )

        confidence_components['final_confidence'] = final_confidence

        result = {
            "member_id": member_id,
            "eligibility_amount": eligibility_amount,
            "eligibility_confidence": eligibility_confidence,
            "loan_risk": risk_label,
            "risk_probability": risk_probability,
            "risk_confidence": risk_confidence,
            "sentiment_risk": sentiment_risk,
            "sentiment_confidence": sentiment_confidence,
            "final_recommendation": final_recommendation,
            "final_confidence": final_confidence,
            "decision_reasoning": decision_reasoning
        }
        results.append(result)

        print(f"📋 Final Recommendation: {final_recommendation}")
        print(f"🎯 Decision Confidence: {final_confidence:.1%}")
        print(f"💡 Reasoning: {decision_reasoning}\n")

    # --- Save results ---
    output_path = os.path.join(base_dir, "integrated_results_with_confidence.csv")
    pd.DataFrame(results).to_csv(output_path, index=False)

    print("✅ Integration Complete!")
    print(f"📊 Combined results saved to: {output_path}")
    
    # Show enhanced summary with confidence analysis
    show_enhanced_summary(results)


# =============================================================================
# CONFIDENCE CALCULATION FUNCTIONS
# =============================================================================

def calculate_eligibility_confidence(eligibility_amount, members_df, member_id):
    """Calculate confidence in eligibility prediction"""
    try:
        member_data = members_df[members_df['id'] == member_id].iloc[0]
        
        confidence_factors = []
        
        # Factor 1: Membership duration (longer = more confidence)
        if 'joinDate' in member_data:
            join_date = pd.to_datetime(member_data['joinDate'])
            membership_days = (pd.Timestamp.now() - join_date).days
            membership_confidence = min(membership_days / 365, 1.0)  # 1 year = max confidence
            confidence_factors.append(membership_confidence * 0.4)
        else:
            confidence_factors.append(0.5 * 0.4)
        
        # Factor 2: Activity status (active = more confidence)
        status_confidence = 1.0 if member_data.get('status') == 'Active' else 0.3
        confidence_factors.append(status_confidence * 0.3)
        
        # Factor 3: Eligibility amount reasonableness
        # Higher amounts with good justification = more confidence
        amount_confidence = min(eligibility_amount / 50000, 1.0)  # Cap at 50K for confidence
        confidence_factors.append(amount_confidence * 0.3)
        
        return min(sum(confidence_factors), 0.95)
    except:
        return 0.6  # Default confidence

def calculate_risk_confidence(risk_label, risk_probability):
    """Calculate confidence in risk assessment"""
    # Higher confidence for extreme probabilities, lower for middle
    if risk_probability < 0.2 or risk_probability > 0.8:
        return 0.85  # High confidence for clear cases
    elif risk_probability < 0.3 or risk_probability > 0.7:
        return 0.75  # Medium-high confidence
    elif risk_probability < 0.4 or risk_probability > 0.6:
        return 0.65  # Medium confidence
    else:
        return 0.55  # Lower confidence for borderline cases

def calculate_sentiment_confidence(sentiment_result):
    """Calculate confidence in sentiment analysis"""
    try:
        total_comments = sentiment_result.get('total_comments_analyzed', 0)
        financial_stress_level = sentiment_result.get('financial_stress_level', 0)
        
        # More comments = higher confidence
        comments_confidence = min(total_comments / 10, 1.0) * 0.6
        
        # Clear patterns = higher confidence
        sentiment_dist = sentiment_result.get('sentiment_distribution', {})
        max_sentiment = max(sentiment_dist.values()) if sentiment_dist else 0
        pattern_confidence = (max_sentiment / 100) * 0.4
        
        return min(comments_confidence + pattern_confidence, 0.9)
    except:
        return 0.5

def compute_final_recommendation_with_confidence(eligibility_amount, risk_label, risk_probability, sentiment_risk, confidence_components):
    """Intelligent recommendation with confidence scores"""
    
    # Base confidence from individual models (weighted average)
    base_confidence = (
        confidence_components['eligibility_confidence'] * 0.4 +  # Eligibility most important
        confidence_components['risk_confidence'] * 0.4 +         # Risk equally important  
        confidence_components['sentiment_confidence'] * 0.2      # Sentiment supporting
    )
    
    # Base eligibility check
    if eligibility_amount < 10000:
        reasoning = "Below minimum eligibility threshold"
        final_confidence = max(base_confidence, 0.8)
        return "REJECT", final_confidence, reasoning
    
    # Risk-based decisions
    if risk_label in ["HIGH", "VERY HIGH"]:
        reasoning = "High default risk profile"
        final_confidence = base_confidence * 0.9
        return "REJECT", final_confidence, reasoning
    
    elif risk_label == "MEDIUM":
        if sentiment_risk == "HIGH":
            reasoning = "Medium risk combined with negative sentiment"
            final_confidence = base_confidence
            return "REJECT", final_confidence, reasoning
        else:
            reasoning = "Medium risk requires careful monitoring"
            final_confidence = base_confidence * 0.8
            return "APPROVE WITH CAUTION", final_confidence, reasoning
    
    # Sentiment-based adjustments
    if sentiment_risk == "HIGH":
        if risk_label == "LOW":
            reasoning = "Good financials but concerning comments"
            final_confidence = base_confidence * 0.7
            return "APPROVE WITH CAUTION", final_confidence, reasoning
        else:
            reasoning = "Risk factors amplified by negative sentiment"
            final_confidence = base_confidence
            return "REJECT", final_confidence, reasoning
    
    elif sentiment_risk == "MEDIUM":
        if risk_label == "LOW":
            reasoning = "Low risk with some sentiment concerns"
            final_confidence = base_confidence * 0.8
            return "APPROVE WITH CAUTION", final_confidence, reasoning
    
    # Default approval for low risk cases
    reasoning = "Strong financial profile with low risk"
    final_confidence = base_confidence * 1.1
    return "APPROVE", min(final_confidence, 0.95), reasoning


# =============================================================================
# ENHANCED SUMMARY WITH CONFIDENCE ANALYSIS
# =============================================================================

def show_enhanced_summary(results):
    """Show summary with confidence analysis"""
    print("\n📈 ENHANCED INTEGRATION SUMMARY:")
    print("===============================")
    
    total_members = len(results)
    decisions = [r['final_recommendation'] for r in results]
    confidences = [r['final_confidence'] for r in results]
    
    approved = sum(1 for d in decisions if d == 'APPROVE')
    caution = sum(1 for d in decisions if d == 'APPROVE WITH CAUTION')
    rejected = sum(1 for d in decisions if d == 'REJECT')
    
    print(f"Total Members Analyzed: {total_members}")
    print(f"✅ APPROVE: {approved} ({approved/total_members*100:.1f}%)")
    print(f"⚠️  APPROVE WITH CAUTION: {caution} ({caution/total_members*100:.1f}%)")
    print(f"❌ REJECT: {rejected} ({rejected/total_members*100:.1f}%)")
    
    # Confidence Analysis
    print(f"\n🎯 CONFIDENCE ANALYSIS:")
    print(f"   Average Decision Confidence: {np.mean(confidences):.1%}")
    print(f"   High Confidence (>80%): {sum(1 for c in confidences if c > 0.8)} decisions")
    print(f"   Medium Confidence (60-80%): {sum(1 for c in confidences if 0.6 <= c <= 0.8)} decisions")
    print(f"   Low Confidence (<60%): {sum(1 for c in confidences if c < 0.6)} decisions")
    
    # Model Confidence Breakdown
    avg_eligibility_conf = np.mean([r['eligibility_confidence'] for r in results])
    avg_risk_conf = np.mean([r['risk_confidence'] for r in results])
    avg_sentiment_conf = np.mean([r['sentiment_confidence'] for r in results])
    
    print(f"\n🔧 MODEL CONFIDENCE BREAKDOWN:")
    print(f"   Eligibility Model: {avg_eligibility_conf:.1%}")
    print(f"   Risk Model: {avg_risk_conf:.1%}")
    print(f"   Sentiment Model: {avg_sentiment_conf:.1%}")
    
    # Risk Distribution
    risk_levels = [r['loan_risk'] for r in results]
    print(f"\n🛡️ RISK DISTRIBUTION:")
    for level in ['VERY LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY HIGH']:
        count = risk_levels.count(level)
        if count > 0:
            print(f"   {level}: {count} members")


if __name__ == "__main__":
    main()