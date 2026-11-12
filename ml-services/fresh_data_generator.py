# fresh_data_generator.py
import pandas as pd
import random
from faker import Faker
from datetime import datetime, timedelta
import uuid
import numpy as np

# Initialize Faker
fake = Faker()

def generate_members_data():
    """Generate members data matching EXACT database schema"""
    print("🔄 Generating members data...")
    
    members_records = []
    group_ids = [f"grp_{i:03d}" for i in range(1, 21)]
    
    # Store member UUIDs for reference
    member_uuids = {}
    
    for i in range(1, 2001):  # Generate 2000 members
        member_uuid = str(uuid.uuid4())  # Use UUID instead of sequential ID
        member_uuids[i] = member_uuid
        group_id = random.choice(group_ids)
        
        # Personal info
        first_name = fake.first_name()
        last_name = fake.last_name()
        email = f"{first_name.lower()}.{last_name.lower()}{i}@email.com"
        phone = f"+1-555-{1000 + (i % 9000):04d}"
        
        # Dates
        join_year = random.choice([2023, 2024, 2025])
        join_date = fake.date_between_dates(
            date_start=datetime(join_year, 1, 1), 
            date_end=datetime(join_year, 12, 31)
        )
        
        # Status and role
        status = random.choices(['Active', 'Inactive', 'Terminated'], weights=[0.7, 0.15, 0.15])[0]
        role = random.choices(['Member', 'GroupAdmin', 'SuperAdmin'], weights=[0.85, 0.1, 0.05])[0]
        
        # Timestamps
        created_on = f"{join_date} {fake.time()}"
        modified_on = created_on
        
        members_records.append({
            'id': member_uuid,  # UUID format
            'group_id': group_id,
            'firstName': first_name,
            'lastName': last_name,
            'email': email,
            'phoneNumber': phone,
            'password': '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
            'joinDate': str(join_date),
            'status': status,
            'role': role,
            'created_by': 'system',
            'modified_by': 'system',
            'created_on': created_on,
            'modified_on': modified_on,
            'mansoft_tenant_id': 'tenant_001'
            # REMOVED: current_age, yearly_income, total_debt, credit_score, num_credit_cards, gender, address
        })
    
    members_df = pd.DataFrame(members_records)
    members_df.to_csv('members_ml_training.csv', index=False)
    print(f"✅ Generated {len(members_df)} members with UUIDs")
    return members_df, member_uuids

def generate_contributions_data(members_df, member_uuids):
    """Generate contributions data matching EXACT database schema"""
    print("🔄 Generating contributions data...")
    
    contributions_records = []
    
    for _, member in members_df.iterrows():
        num_contributions = random.randint(12, 60)  # 1-5 years of contributions
        
        # Use random base amount since we don't have income data
        base_amount = random.randint(500, 2000)
        
        for _ in range(num_contributions):
            contribution_id = str(uuid.uuid4())
            amount = round(base_amount * random.uniform(0.8, 1.2), 2)
            transaction_date = fake.date_between_dates(
                date_start=datetime(2020, 1, 1),
                date_end=datetime(2025, 12, 31)
            )
            transaction_type = random.choices(
                ['Contribution', 'Expense', 'Loan Payment'], 
                weights=[0.8, 0.1, 0.1]
            )[0]
            payment_method = random.choice(['mobile', 'bank', 'cash'])
            status = 'Completed' if random.random() > 0.1 else 'Pending'
            
            created_on = f"{transaction_date} {fake.time()}"
            
            contributions_records.append({
                'id': contribution_id,
                'member_id': member['id'],  # Use UUID
                'group_id': member['group_id'],
                'transactionType': transaction_type,
                'amount': amount,
                'transactionDate': str(transaction_date),
                'paymentMethod': payment_method,
                'status': status,
                'description': f"{transaction_type} via {payment_method}",
                'created_by': 'system',
                'modified_by': 'system',
                'created_on': created_on,
                'modified_on': created_on,
                'mansoft_tenant_id': 'tenant_001'
            })
    
    contributions_df = pd.DataFrame(contributions_records)
    contributions_df.to_csv('contributions_ml_training.csv', index=False)
    print(f"✅ Generated {len(contributions_df)} contributions")
    return contributions_df

def generate_loans_data(members_df, member_uuids):
    """Generate loans data matching EXACT database schema"""
    print("🔄 Generating loans data...")
    
    loans_records = []
    
    # Get first member UUID for approver
    approver_id = members_df.iloc[0]['id']
    
    for _, member in members_df.iterrows():
        if random.random() < 0.7:  # 70% have loans
            num_loans = random.randint(1, 5)
            
            for _ in range(num_loans):
                loan_id = str(uuid.uuid4())
                
                # Loan details
                amount = random.randint(5000, 100000)
                interest_rate = round(random.uniform(5.0, 15.0), 2)
                start_date = fake.date_between_dates(
                    date_start=datetime(2023, 1, 1),
                    date_end=datetime(2025, 12, 31)
                )
                
                # Status and calculations
                status = random.choices(
                    ['Active', 'Repaid', 'Defaulted', 'Pending'], 
                    weights=[0.1, 0.7, 0.15, 0.05]
                )[0]
                
                duration_months = random.choice([6, 12, 18, 24])
                due_date = start_date + timedelta(days=duration_months * 30)
                
                # Outstanding balance logic
                if status == 'Repaid':
                    outstanding_balance = 0
                elif status == 'Active':
                    outstanding_balance = round(amount * random.uniform(0.1, 0.9), 2)
                else:
                    outstanding_balance = round(amount * random.uniform(0.5, 1.0), 2)
                
                created_on = f"{start_date} {fake.time()}"
                
                loans_records.append({
                    'id': loan_id,
                    'member_id': member['id'],  # Use UUID
                    'group_id': member['group_id'],
                    'amount': amount,
                    'interestRate': interest_rate,
                    'startDate': str(start_date),
                    'dueDate': str(due_date),
                    'status': status,
                    'outstandingBalance': outstanding_balance,
                    'approvedBy_member_id': approver_id,  # Use UUID
                    'created_by': 'system',
                    'modified_by': 'system',
                    'created_on': created_on,
                    'modified_on': created_on,
                    'mansoft_tenant_id': 'tenant_001'
                    # REMOVED: credit_score_at_approval, yearly_income_at_approval
                })
    
    loans_df = pd.DataFrame(loans_records)
    loans_df.to_csv('loans_ml_training.csv', index=False)
    print(f"✅ Generated {len(loans_df)} loans")
    return loans_df

def generate_notifications_data(members_df):
    """Generate notifications data matching EXACT database schema"""
    print("🔄 Generating notifications data...")
    
    notifications_records = []
    
    for _, member in members_df.iterrows():
        num_notifications = random.randint(3, 15)
        
        for _ in range(num_notifications):
            notification_id = str(uuid.uuid4())
            
            notification_type = random.choice(['Reminder', 'Alert', 'Update', 'Meeting'])
            message_content = f"Notification for {member['firstName']} {member['lastName']}"
            send_date = fake.date_between_dates(
                date_start=datetime(2024, 1, 1),
                date_end=datetime(2025, 12, 31)
            )
            channel = random.choice(['email', 'sms', 'mobile_app'])
            
            created_on = f"{send_date} {fake.time()}"
            
            notifications_records.append({
                'id': notification_id,
                'member_id': member['id'],  # Use UUID
                'type': notification_type,
                'messageContent': message_content,
                'sendDate': str(send_date),
                'channel': channel,
                'created_by': 'system',
                'modified_by': 'system',
                'created_on': created_on,
                'modified_on': created_on,
                'mansoft_tenant_id': 'tenant_001'
                # REMOVED: is_read, group_id, sender_name, title (not in DB schema)
            })
    
    notifications_df = pd.DataFrame(notifications_records)
    notifications_df.to_csv('notifications_ml_training.csv', index=False)
    print(f"✅ Generated {len(notifications_df)} notifications")
    return notifications_df

def generate_additional_tables(members_df):
    """Generate other tables: meetings, expenses, documents"""
    print("🔄 Generating additional tables...")
    
    # Meetings
    meetings_records = []
    for i in range(1000):
        meetings_records.append({
            'id': str(uuid.uuid4()),
            'group_id': random.choice(members_df['group_id'].unique()),
            'meetingDate': str(fake.date_between_dates(
                date_start=datetime(2023, 1, 1),
                date_end=datetime(2025, 12, 31)
            )),
            'meetingTime': fake.time(),
            'meetingLink': f"https://meet.example.com/{uuid.uuid4()}",
            'title': f"Group Meeting {i+1}",
            'agenda': f"Discussion agenda for meeting {i+1}",
            'created_by': 'system',
            'modified_by': 'system',
            'created_on': fake.date_time_between(start_date='-2y', end_date='now').strftime('%Y-%m-%d %H:%M:%S'),
            'modified_on': fake.date_time_between(start_date='-2y', end_date='now').strftime('%Y-%m-%d %H:%M:%S'),
            'mansoft_tenant_id': 'tenant_001'
        })
    
    meetings_df = pd.DataFrame(meetings_records)
    meetings_df.to_csv('meetings_ml_training.csv', index=False)
    
    # Expenses
    expenses_records = []
    for i in range(500):
        random_member = members_df.sample(1).iloc[0]
        expenses_records.append({
            'id': str(uuid.uuid4()),
            'group_id': random_member['group_id'],
            'dateIncurred': str(fake.date_between_dates(
                date_start=datetime(2023, 1, 1),
                date_end=datetime(2025, 12, 31)
            )),
            'amount': round(random.uniform(100, 5000), 2),
            'description': f"Expense for group activities {i+1}",
            'approvedBy_member_id': random_member['id'],
            'created_by': 'system',
            'modified_by': 'system',
            'created_on': fake.date_time_between(start_date='-2y', end_date='now').strftime('%Y-%m-%d %H:%M:%S'),
            'modified_on': fake.date_time_between(start_date='-2y', end_date='now').strftime('%Y-%m-%d %H:%M:%S'),
            'mansoft_tenant_id': 'tenant_001'
        })
    
    expenses_df = pd.DataFrame(expenses_records)
    expenses_df.to_csv('expenses_ml_training.csv', index=False)
    
    print(f"✅ Generated {len(meetings_df)} meetings and {len(expenses_df)} expenses")
    return meetings_df, expenses_df

# Execute complete data generation
if __name__ == "__main__":
    print("🚀 STARTING FRESH DATA GENERATION...")
    print("📝 Generating data that EXACTLY matches your database schema!")
    
    # Generate all datasets
    members_df, member_uuids = generate_members_data()
    contributions_df = generate_contributions_data(members_df, member_uuids)
    loans_df = generate_loans_data(members_df, member_uuids)
    notifications_df = generate_notifications_data(members_df)
    meetings_df, expenses_df = generate_additional_tables(members_df)
    
    print("\n🎉 FRESH DATA GENERATION COMPLETED!")
    print("📊 Generated files (EXACT DB SCHEMA):")
    print(f"   - members_ml_training.csv ({len(members_df)} records)")
    print(f"   - contributions_ml_training.csv ({len(contributions_df)} records)")
    print(f"   - loans_ml_training.csv ({len(loans_df)} records)")
    print(f"   - notifications_ml_training.csv ({len(notifications_df)} records)")
    print(f"   - meetings_ml_training.csv ({len(meetings_df)} records)")
    print(f"   - expenses_ml_training.csv ({len(expenses_df)} records)")
    
    print("\n✅ ALL FILES NOW MATCH YOUR EXACT DATABASE SCHEMA!")
    print("🔑 All IDs are UUIDs (not sequential)")
    print("🗃️  All columns match your database tables exactly")
    print("🚀 Ready to build ML models with production-like data!")