# sentiment-analyzer/predict.py

import pandas as pd
import sys
import os

sys.path.append('..')

from model import SentimentAnalyzer

def analyze_member_sentiment_history(member_id):
    """Analyze sentiment history for a specific member"""
    sentiment_analyzer = SentimentAnalyzer()
    sentiment_analyzer.load_model()
    
    # Analyze member sentiment (model handles data loading)
    result = sentiment_analyzer.analyze_member_sentiment(member_id)
    
    return result

def main():
    print("😊 SENTIMENT ANALYZER - PREDICTION")
    print("==========================================")
    
    # Initialize analyzer
    sentiment_analyzer = SentimentAnalyzer()
    sentiment_analyzer.load_model()
    
    # Test specific predictions
    print("🔍 TESTING SENTIMENT ANALYSIS:")
    print("==========================================")
    
    test_messages = [
        ("Struggling to pay rent and utilities this month", "chat"),
        ("Excited about my savings progress!", "email"),
        ("Submitted my contribution on time", "mobile_app"),
        ("Lost my job last week, having financial difficulties", "meeting"),
        ("The group meetings have been very helpful", "chat")
    ]
    
    for i, (message, channel) in enumerate(test_messages, 1):
        result = sentiment_analyzer.predict_sentiment(message, channel)
        
        print(f"\n📝 Message {i}: '{message}'")
        print(f"   Channel: {channel}")
        print(f"   🎯 Sentiment: {result['sentiment'].upper()}")
        print(f"   📊 Confidence: {result['confidence']}%")
        print(f"   📈 VADER Score: {result['vader_score']:.3f}")
        
        # Emoji based on sentiment
        emoji_map = {
            'positive': '😊 POSITIVE',
            'negative': '😟 NEGATIVE', 
            'neutral': '😐 NEUTRAL',
            'financial_stress': '🚨 FINANCIAL STRESS'
        }
        print(f"   {emoji_map.get(result['sentiment'], '📝')}")
    
    # Analyze specific members
    print(f"\n🔍 ANALYZING MEMBER SENTIMENT HISTORY:")
    print("==========================================")
    
    # Get some actual member IDs from the CORRECT data
    comments_df = pd.read_csv('../data/member_comments_ml_training.csv')
    actual_member_ids = comments_df['member_id'].sample(3).tolist()
    
    for member_id in actual_member_ids:
        print(f"\n👤 ANALYZING MEMBER: {member_id}")
        print("-" * 40)
        
        result = analyze_member_sentiment_history(member_id)
        
        if 'error' in result:
            print(f"❌ {result['error']}")
            continue
        
        # Display results
        print(f"📊 Total Comments Analyzed: {result['total_comments_analyzed']}")
        print(f"🎯 Overall Risk Indicator: {result['overall_risk_indicator']}")
        print(f"💰 Financial Stress Level: {result['financial_stress_level']}%")
        
        print(f"\n📈 Sentiment Distribution:")
        for sentiment, percentage in result['sentiment_distribution'].items():
            bar = "█" * int(percentage / 5)
            print(f"   {sentiment:15}: {percentage:5.1f}% {bar}")
        
        print(f"\n📝 Recent Comments Analysis:")
        for i, sentiment in enumerate(result['recent_sentiments'][-3:], 1):
            emoji = "😊" if sentiment['sentiment'] == 'positive' else "😟" if sentiment['sentiment'] in ['negative', 'financial_stress'] else "😐"
            print(f"   {i}. {emoji} {sentiment['sentiment']:15} ({sentiment['confidence']}%)")
            print(f"      Preview: '{sentiment['text_preview']}'")
        
        # Risk assessment
        print(f"\n⚠️  RISK ASSESSMENT:")
        if result['financial_stress_level'] > 40:
            print("   🚨 HIGH RISK: Frequent financial stress mentions")
        elif result['financial_stress_level'] > 20:
            print("   ⚠️  MEDIUM RISK: Some financial concerns")
        else:
            print("   ✅ LOW RISK: Minimal financial stress indicators")

if __name__ == "__main__":
    main()