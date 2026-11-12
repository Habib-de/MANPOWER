# generate_sentiment_data.py
import pandas as pd
import numpy as np
from faker import Faker
import uuid
from datetime import datetime, timedelta
import random

fake = Faker()

def generate_member_comments():
    """Generate REAL member comments with emotional content for sentiment analysis"""
    print("📝 Generating realistic member comments for sentiment analysis...")
    
    # Load existing members to get real member IDs
    members_df = pd.read_csv('../data/members_ml_training.csv')
    member_ids = members_df['id'].tolist()
    
    # Realistic comment templates with emotional content
    comment_templates = {
        'financial_stress': [
            "I'm really struggling to pay my bills this month after unexpected medical expenses",
            "Lost my job last week and don't know how I'll make the next contribution",
            "Emergency car repairs wiped out my savings, need help with this month's payment",
            "Rent increased and I'm falling behind on all my financial commitments",
            "Medical bills are piling up and I can't keep up with the contributions",
            "Unexpected school fees for my children have strained my budget completely",
            "My business is struggling and cash flow is very tight right now",
            "Family emergency required all my savings, struggling to recover financially"
        ],
        'positive': [
            "So excited about my savings progress! The group has been very helpful",
            "Just made my highest contribution yet, feeling great about my financial future",
            "The financial planning advice from the group has transformed my savings approach",
            "I've learned so much about money management from our meetings",
            "My small business is doing well and I can contribute consistently now",
            "Finally debt-free and excited to build my savings with the group",
            "The group support has helped me achieve my first major financial goal",
            "Regular contributions are becoming a habit and I'm seeing real progress"
        ],
        'negative': [
            "Worried I might not be able to make the full contribution this month",
            "Having some difficulties balancing all my financial responsibilities",
            "Concerned about expenses this month, might need to reduce my contribution",
            "Not sure if I can maintain this contribution level with current expenses",
            "Feeling anxious about upcoming financial commitments",
            "This month has been tough financially, struggling to keep up",
            "Worried about falling behind on my savings goals",
            "Financial pressures are making it hard to focus on contributions"
        ],
        'neutral': [
            "Submitted my regular contribution for this month",
            "Attended the group meeting today as scheduled",
            "Made my standard monthly contribution via mobile banking",
            "Planning my contributions for the next quarter",
            "Reviewed my financial progress with the group admin",
            "Updated my contribution schedule for the coming months",
            "Discussed savings strategies in today's meeting",
            "Completed my monthly financial review and contribution"
        ]
    }
    
    comments_records = []
    
    # Generate 3-8 comments per member
    for member_id in member_ids:
        num_comments = random.randint(3, 8)
        
        for _ in range(num_comments):
            # Randomly select sentiment type
            sentiment_type = random.choices(
                ['financial_stress', 'positive', 'negative', 'neutral'],
                weights=[0.15, 0.35, 0.25, 0.25]  # More positive/neutral, some stress/negative
            )[0]
            
            # Select random template for that sentiment
            message_content = random.choice(comment_templates[sentiment_type])
            
            # Generate random date in the last 2 years
            comment_date = fake.date_between_dates(
                date_start=datetime(2023, 1, 1),
                date_end=datetime(2025, 12, 31)
            )
            
            # Random channel
            channel = random.choice(['meeting', 'chat', 'email', 'mobile_app'])
            
            # Timestamps
            created_on = f"{comment_date} {fake.time()}"
            
            comments_records.append({
                'id': str(uuid.uuid4()),
                'member_id': member_id,
                'type': sentiment_type,
                'message_content': message_content,
                'send_date': str(comment_date),
                'channel': channel,
                'created_by': 'system',
                'modified_by': 'system', 
                'created_on': created_on,
                'modified_on': created_on,
                'mansoft_tenant_id': 'tenant_001'
            })
    
    comments_df = pd.DataFrame(comments_records)
    
    # Save the file
    output_file = '../data/member_comments_ml_training.csv'
    comments_df.to_csv(output_file, index=False)
    
    print(f"✅ Generated {len(comments_df)} realistic member comments!")
    print(f"💾 Saved to: {output_file}")
    
    # Show distribution
    print(f"\n📊 Sentiment Distribution:")
    sentiment_counts = comments_df['type'].value_counts()
    for sentiment, count in sentiment_counts.items():
        percentage = (count / len(comments_df)) * 100
        print(f"   {sentiment:15}: {count:4} comments ({percentage:.1f}%)")
    
    print(f"\n📱 Channel Distribution:")
    channel_counts = comments_df['channel'].value_counts()
    for channel, count in channel_counts.items():
        percentage = (count / len(comments_df)) * 100
        print(f"   {channel:15}: {count:4} comments ({percentage:.1f}%)")
    
    print(f"\n📝 Sample Comments:")
    for i in range(3):
        comment = comments_df.iloc[i]
        print(f"   {i+1}. [{comment['type']}] '{comment['message_content']}'")
    
    return comments_df

if __name__ == "__main__":
    generate_member_comments()