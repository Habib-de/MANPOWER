# loan-risk-predictor/evaluate.py

import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, precision_recall_curve
import matplotlib.pyplot as plt
import sys
import os

sys.path.append('..')

from model import LoanRiskPredictor

def comprehensive_evaluation():
    print("🛡️ LOAN RISK PREDICTOR - COMPREHENSIVE EVALUATION")
    print("============================================================")
    
    # Load data
    print("📊 Loading data...")
    members_df = pd.read_csv('../data/members_ml_training.csv')
    loans_df = pd.read_csv('../data/loans_ml_training.csv')
    
    # Initialize model
    risk_predictor = LoanRiskPredictor()
    
    # Prepare features
    features_df = risk_predictor.prepare_features(members_df, loans_df)
    
    # Load trained model
    risk_predictor.load_model()
    
    # Prepare test data
    X = features_df[risk_predictor.feature_columns]
    y = features_df['is_high_risk']
    
    X_scaled = risk_predictor.scaler.transform(X)
    
    # Predictions
    y_pred = risk_predictor.model.predict(X_scaled)
    y_pred_proba = risk_predictor.model.predict_proba(X_scaled)[:, 1]
    
    # Comprehensive evaluation
    print("\n📊 MODEL PERFORMANCE METRICS:")
    print("============================================================")
    
    # Accuracy metrics
    accuracy = np.mean(y_pred == y)
    print(f"🎯 Accuracy: {accuracy:.4f}")
    
    # ROC-AUC
    roc_auc = roc_auc_score(y, y_pred_proba)
    print(f"📊 ROC-AUC Score: {roc_auc:.4f}")
    
    # Classification report
    print("\n📈 CLASSIFICATION REPORT:")
    print(classification_report(y, y_pred, target_names=['Low Risk', 'High Risk']))
    
    # Confusion matrix
    cm = confusion_matrix(y, y_pred)
    print("\n🔢 CONFUSION MATRIX:")
    print(f"True Negatives (Low Risk Correct): {cm[0, 0]}")
    print(f"False Positives (Low Risk Wrong): {cm[0, 1]}")
    print(f"False Negatives (High Risk Wrong): {cm[1, 0]}")
    print(f"True Positives (High Risk Correct): {cm[1, 1]}")
    
    # Business impact analysis
    print("\n💼 BUSINESS IMPACT ANALYSIS:")
    print("============================================================")
    
    total_members = len(y)
    high_risk_members = y.sum()
    
    print(f"📊 Total Members: {total_members}")
    print(f"🚨 Actual High Risk: {high_risk_members} ({high_risk_members/total_members*100:.2f}%)")
    print(f"📈 Predicted High Risk: {y_pred.sum()} ({y_pred.sum()/total_members*100:.2f}%)")
    
    # Financial impact (assuming average loan amount)
    avg_loan = loans_df['amount'].mean()
    false_negatives_cost = cm[1, 0] * avg_loan * 0.8  # 80% of defaulted amount lost
    false_positives_cost = cm[0, 1] * avg_loan * 0.1  # 10% opportunity cost
    
    print(f"💰 Estimated False Negatives Cost: KES {false_negatives_cost:,.0f}")
    print(f"💰 Estimated False Positives Cost: KES {false_positives_cost:,.0f}")
    print(f"💵 Total Model Value: KES {false_negatives_cost - false_positives_cost:,.0f}")
    
    # Feature importance
    print("\n🔍 FEATURE IMPORTANCE:")
    print("============================================================")
    
    feature_importance = pd.DataFrame({
        'feature': risk_predictor.feature_columns,
        'importance': risk_predictor.model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    for _, row in feature_importance.iterrows():
        print(f"   {row['feature']:25}: {row['importance']:.4f}")
    
    # Risk threshold analysis
    print("\n🎯 RISK THRESHOLD ANALYSIS:")
    print("============================================================")
    
    thresholds = [0.3, 0.5, 0.7]
    for threshold in thresholds:
        y_pred_threshold = (y_pred_proba >= threshold).astype(int)
        accuracy_at_threshold = np.mean(y_pred_threshold == y)
        high_risk_rate = y_pred_threshold.mean()
        
        print(f"📈 Threshold {threshold}:")
        print(f"   Accuracy: {accuracy_at_threshold:.4f}")
        print(f"   High Risk Rate: {high_risk_rate:.4f}")
        print(f"   Precision: {np.mean(y[y_pred_threshold == 1] == 1) if y_pred_threshold.sum() > 0 else 0:.4f}")

if __name__ == "__main__":
    comprehensive_evaluation()