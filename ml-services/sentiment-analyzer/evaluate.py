# sentiment-analyzer/evaluate.py

import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import matplotlib.pyplot as plt
import sys
import os

sys.path.append('..')

from model import SentimentAnalyzer

def comprehensive_evaluation():
    print("😊 SENTIMENT ANALYZER - COMPREHENSIVE EVALUATION")
    print("============================================================")
    
    # Load data
    print("📊 Loading comments data...")
    comments_df = pd.read_csv('../data/member_comments_highly_varied.csv')
    
    # Initialize model
    sentiment_analyzer = SentimentAnalyzer()
    
    # Prepare features and get true labels
    X, y_true, features_df = sentiment_analyzer.prepare_training_data(comments_df)
    
    # Load trained model
    sentiment_analyzer.load_model()
    
    # Make predictions
    y_pred = sentiment_analyzer.model.predict(X)
    
    # Comprehensive evaluation
    print("\n📊 MODEL PERFORMANCE METRICS:")
    print("============================================================")
    
    # Accuracy
    accuracy = accuracy_score(y_true, y_pred)
    print(f"🎯 Accuracy: {accuracy:.4f}")
    
    # Classification report
    print("\n📈 CLASSIFICATION REPORT:")
    print(classification_report(y_true, y_pred))
    
    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    print("\n🔢 CONFUSION MATRIX:")
    print(cm)
    
    # Business impact analysis
    print("\n💼 BUSINESS IMPACT ANALYSIS:")
    print("============================================================")
    
    # Financial stress detection accuracy
    financial_stress_comments = features_df[features_df['type'] == 'financial_stress']
    if not financial_stress_comments.empty:
        fs_predictions = y_pred[features_df['type'] == 'financial_stress']
        fs_accuracy = np.mean(fs_predictions == 'financial_stress')
        print(f"💰 Financial Stress Detection Accuracy: {fs_accuracy:.4f}")
        
        # Missed financial stress (false negatives)
        missed_fs = len(financial_stress_comments) - np.sum(fs_predictions == 'financial_stress')
        print(f"🚨 Missed Financial Stress Cases: {missed_fs}")
    
    # Channel-wise performance
    print(f"\n📱 CHANNEL-WISE PERFORMANCE:")
    channels = features_df['channel'].unique()
    for channel in channels:
        channel_mask = features_df['channel'] == channel
        if channel_mask.sum() > 0:
            channel_accuracy = accuracy_score(y_true[channel_mask], y_pred[channel_mask])
            print(f"   {channel:15}: {channel_accuracy:.4f} accuracy")
    
    # Risk assessment capability
    print(f"\n⚠️  RISK ASSESSMENT CAPABILITY:")
    high_risk_members = features_df.groupby('member_id').apply(
        lambda x: (x['type'] == 'financial_stress').mean() > 0.3
    ).sum()
    print(f"   Members with >30% financial stress comments: {high_risk_members}")
    
    # Sample error analysis
    print(f"\n🔍 SAMPLE MISCLASSIFICATIONS:")
    errors = features_df[y_true != y_pred].head(5)
    for _, error in errors.iterrows():
        print(f"   Text: '{error['message_content'][:60]}...'")
        print(f"   Actual: {error['type']} → Predicted: {y_pred[error.name]}")
        print()

if __name__ == "__main__":
    comprehensive_evaluation()