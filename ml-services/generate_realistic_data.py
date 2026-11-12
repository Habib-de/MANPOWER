"""
generate_realistic_data_LARGE.py
Creates REALISTIC Kenyan SACCO data at PROPER scale for ML training
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import uuid
from tqdm import tqdm  # Progress bar

class LargeSaccoDataGenerator:
    def __init__(self):
        # SACCO-SCALE NUMBERS
        self.total_members = 5000          # Real SACCO size
        self.groups = 50                   # 50 groups/chapters
        self.years_of_data = 5             # 5 years of historical data
        
        # Kenyan Names (expanded)
        self.kenyan_firstnames = [
            "John", "Mary", "Joseph", "Grace", "David", "Sarah", "Peter", "Jane",
            "James", "Esther", "Michael", "Faith", "Paul", "Ruth", "Samuel", "Mercy",
            "Daniel", "Joyce", "Simon", "Agnes", "Thomas", "Lucy", "Robert", "Anne",
            "William", "Catherine", "Charles", "Margaret", "George", "Elizabeth",
            "Patrick", "Susan", "Anthony", "Monica", "Martin", "Teresa", "Stephen",
            "Beatrice", "Andrew", "Christine", "Edward", "Rose", "Richard", "Patricia",
            "Kenneth", "Dorothy", "Brian", "Lydia", "Kevin", "Irene", "Eric", "Nancy",
            "Mark", "Gladys", "Philip", "Naomi", "Francis", "Mildred", "Albert", "Joy"
        ] * 10  # Multiply for variety
        
        self.kenyan_lastnames = [
            "Ochieng", "Achieng", "Odhiambo", "Akinyi", "Otieno", "Atieno", "Omondi",
            "Adhiambo", "Owino", "Awino", "Onyango", "Anyango", "Okoth", "Aoko",
            "Mbugua", "Wanjiru", "Kariuki", "Nyambura", "Njoroge", "Wambui", "Kamau",
            "Njeri", "Maina", "Muthoni", "Ngugi", "Wangui", "Mwangi", "Nyokabi",
            "Kirui", "Chepkoech", "Langat", "Chebet", "Kiprop", "Jepchirchir",
            "Kiplagat", "Chepngetich", "Kipchoge", "Kosgei", "Kemboi", "Jeptoo"
        ] * 10
        
    def generate_members(self):
        """Generate 5000 SACCO members"""
        print("👥 Generating 5,000 members...")
        members = []
        
        for i in tqdm(range(self.total_members)):
            member_id = str(uuid.uuid4())
            
            # Join dates spread over 5 years
            join_date = datetime(2020, 1, 1) + timedelta(days=random.randint(0, 365*5))
            
            # Realistic distribution
            status = random.choices(
                ['Active', 'Inactive', 'Terminated'], 
                weights=[80, 15, 5],  # 80% active, 15% inactive, 5% terminated
                k=1
            )[0]
            
            role = random.choices(
                ['Member', 'GroupAdmin', 'SuperAdmin'], 
                weights=[94, 5, 1],  # 94% regular members, 5% group admins, 1% super admins
                k=1
            )[0]
            
            # Kenyan phone numbers
            phone_number = f"+2547{random.randint(10, 99)}{random.randint(100000, 999999)}"
            
            members.append({
                'id': member_id,
                'group_id': f"grp_{random.randint(1, self.groups):03d}",
                'firstName': random.choice(self.kenyan_firstnames),
                'lastName': random.choice(self.kenyan_lastnames),
                'email': f"{random.choice(self.kenyan_firstnames).lower()}.{random.choice(self.kenyan_lastnames).lower()}{i+1}@gmail.com",
                'phoneNumber': phone_number,
                'password': '$2y$10$hashedpasswordexample123456789012',
                'joinDate': join_date.strftime('%Y-%m-%d'),
                'status': status,
                'role': role,
                'created_by': 'system',
                'modified_by': 'system',
                'created_on': join_date.strftime('%Y-%m-%d %H:%M:%S'),
                'modified_on': join_date.strftime('%Y-%m-%d %H:%M:%S'),
                'mansoft_tenant_id': 'tenant_001'
            })
        
        return pd.DataFrame(members)
    
    def generate_contributions(self, members_df):
        """Generate contributions at SACCO scale"""
        print("💰 Generating contributions...")
        contributions = []
        contrib_batch = []
        
        batch_size = 1000
        members_list = members_df.to_dict('records')
        
        for member_idx, member in enumerate(tqdm(members_list)):
            member_id = member['id']
            join_date = datetime.strptime(member['joinDate'], '%Y-%m-%d')
            status = member['status']
            
            # Active members: 12-60 contributions (1-5 years)
            # Inactive: 1-12 contributions
            if status == 'Active':
                num_contributions = random.randint(12, 60)
                completion_rate = 0.92
            else:
                num_contributions = random.randint(1, 12)
                completion_rate = 0.65
            
            for i in range(num_contributions):
                contrib_date = join_date + timedelta(days=30*i + random.randint(-5, 5))
                
                # Real SACCO contribution amounts
                amount_options = [200, 300, 500, 1000, 1500, 2000, 2500, 3000]
                amount = random.choice(amount_options)
                
                # 90% contributions, 10% expenses
                if random.random() < 0.9:
                    transaction_type = 'Contribution'
                    description = "Monthly savings contribution"
                else:
                    transaction_type = 'Expense'
                    amount = -abs(amount)
                    description = "Group expense payment"
                
                # Status
                if random.random() < completion_rate:
                    contrib_status = 'Completed'
                else:
                    contrib_status = 'Pending'
                
                contrib_batch.append({
                    'id': str(uuid.uuid4()),
                    'member_id': member_id,
                    'group_id': member['group_id'],
                    'transactionType': transaction_type,
                    'amount': abs(amount),
                    'transactionDate': contrib_date.strftime('%Y-%m-%d'),
                    'paymentMethod': random.choice(['M-Pesa', 'Cash', 'Bank Transfer']),
                    'status': contrib_status,
                    'description': description,
                    'created_by': 'system',
                    'modified_by': 'system',
                    'created_on': contrib_date.strftime('%Y-%m-%d %H:%M:%S'),
                    'modified_on': contrib_date.strftime('%Y-%m-%d %H:%M:%S'),
                    'mansoft_tenant_id': 'tenant_001'
                })
            
            # Batch processing to manage memory
            if len(contrib_batch) >= batch_size or member_idx == len(members_list) - 1:
                contributions.extend(contrib_batch)
                contrib_batch = []
        
        return pd.DataFrame(contributions)
    
    def generate_loans(self, members_df, contributions_df):
        """Generate loans at SACCO scale"""
        print("🏦 Generating loans...")
        loans = []
        
        # Group contributions by member for quick lookup
        print("   Calculating member savings...")
        member_savings = {}
        for _, row in contributions_df.iterrows():
            if row['transactionType'] == 'Contribution' and row['status'] == 'Completed':
                member_id = row['member_id']
                member_savings[member_id] = member_savings.get(member_id, 0) + row['amount']
        
        members_list = members_df.to_dict('records')
        batch_size = 500
        
        for batch_start in tqdm(range(0, len(members_list), batch_size)):
            batch_end = min(batch_start + batch_size, len(members_list))
            
            for member in members_list[batch_start:batch_end]:
                member_id = member['id']
                
                # Only active members get loans
                if member['status'] != 'Active':
                    continue
                
                join_date = datetime.strptime(member['joinDate'], '%Y-%m-%d')
                months_member = (datetime.now() - join_date).days / 30
                
                # Skip if member joined less than 3 months ago
                if months_member < 3:
                    continue
                
                # Calculate eligibility
                savings = member_savings.get(member_id, 0)
                
                if savings == 0:
                    continue  # No savings, no loans
                
                # SACCO lending rules
                if months_member > 36:
                    eligibility_multiplier = 3.0  # 3x savings for 3+ years
                elif months_member > 24:
                    eligibility_multiplier = 2.5  # 2.5x for 2-3 years
                elif months_member > 12:
                    eligibility_multiplier = 2.0  # 2x for 1-2 years
                elif months_member > 6:
                    eligibility_multiplier = 1.5  # 1.5x for 6-12 months
                else:
                    eligibility_multiplier = 1.0  # 1x for 3-6 months
                
                max_loan = savings * eligibility_multiplier
                
                # Realistic loan amounts
                loan_amount_options = [
                    5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000,
                    60000, 75000, 100000, 125000, 150000, 200000, 250000, 300000
                ]
                
                possible_amounts = [amt for amt in loan_amount_options if amt <= max_loan]
                
                if not possible_amounts:
                    continue
                
                # Loan probability based on member history
                base_probability = 0.6  # 60% base chance
                if months_member > 24:
                    base_probability = 0.8  # 80% for long-term members
                elif months_member > 12:
                    base_probability = 0.7  # 70% for established members
                
                if random.random() < base_probability:
                    # Number of loans (1-4)
                    num_loans = random.choices([1, 2, 3, 4], weights=[60, 25, 10, 5], k=1)[0]
                    
                    for loan_num in range(num_loans):
                        loan_amount = random.choice(possible_amounts)
                        
                        # Loan date (staggered)
                        loan_date = join_date + timedelta(days=random.randint(90, min(365*3, (datetime.now() - join_date).days)))
                        
                        # Interest rate (10-18% based on risk)
                        base_rate = 12.0
                        risk_score = random.random()
                        if risk_score < 0.2:
                            interest_rate = base_rate - 2.0  # 10% for best members
                        elif risk_score < 0.5:
                            interest_rate = base_rate  # 12% standard
                        elif risk_score < 0.8:
                            interest_rate = base_rate + 2.0  # 14% higher risk
                        else:
                            interest_rate = base_rate + 4.0  # 16% highest risk
                        
                        interest_rate = round(interest_rate, 2)
                        
                        # Loan duration
                        duration_months = random.choice([6, 12, 18, 24, 36])
                        due_date = loan_date + timedelta(days=duration_months * 30)
                        
                        # REALISTIC loan status distribution
                        status_weights = {
                            'Repaid': 68,      # 68% repaid (majority)
                            'Active': 22,      # 22% currently active
                            'Defaulted': 6,    # 6% defaulted (real SACCO default rate)
                            'Overdue': 3,      # 3% overdue
                            'Pending': 1       # 1% pending
                        }
                        
                        loan_status = random.choices(
                            list(status_weights.keys()),
                            weights=list(status_weights.values()),
                            k=1
                        )[0]
                        
                        # Calculate outstanding balance realistically
                        if loan_status == 'Repaid':
                            outstanding = 0.0
                        elif loan_status == 'Defaulted':
                            # Defaulted after some payments
                            payments_made = random.uniform(0.1, 0.7)
                            outstanding = loan_amount * (1 - payments_made)
                        elif loan_status == 'Overdue':
                            # Overdue but some payments made
                            payments_made = random.uniform(0.5, 0.9)
                            outstanding = loan_amount * (1 - payments_made)
                        elif loan_status == 'Active':
                            # Active loan with some payments made
                            months_passed = random.randint(1, duration_months-1)
                            payments_made = months_passed / duration_months
                            outstanding = loan_amount * (1 - payments_made)
                        else:  # Pending
                            outstanding = loan_amount
                        
                        outstanding = round(outstanding, 2)
                        
                        loans.append({
                            'id': str(uuid.uuid4()),
                            'member_id': member_id,
                            'group_id': member['group_id'],
                            'amount': loan_amount,
                            'interestRate': interest_rate,
                            'startDate': loan_date.strftime('%Y-%m-%d'),
                            'dueDate': due_date.strftime('%Y-%m-%d'),
                            'status': loan_status,
                            'outstandingBalance': outstanding,
                            'approvedBy_member_id': member_id,
                            'created_by': 'system',
                            'modified_by': 'system',
                            'created_on': loan_date.strftime('%Y-%m-%d %H:%M:%S'),
                            'modified_on': loan_date.strftime('%Y-%m-%d %H:%M:%S'),
                            'mansoft_tenant_id': 'tenant_001'
                        })
        
        return pd.DataFrame(loans)
    
    def generate_notifications(self, members_df, loans_df):
        """Generate notifications at scale"""
        print("📱 Generating notifications...")
        notifications = []
        
        # Expanded loan purposes
        loan_purposes = [
            "Need KES 50,000 for dairy cows purchase", "Starting poultry farm with 200 chickens",
            "School fees for 3 children", "Medical emergency at Kenyatta Hospital",
            "Expanding maize farm to 5 acres", "Restocking my supermarket",
            "Building rental house in Ruiru", "Purchase 14-seater matatu",
            "Wedding expenses for daughter", "Opening hair salon in town",
            "Buying irrigation equipment", "Paying hospital bill at Aga Khan",
            "Purchasing boda boda motorcycle", "Construction materials for shop",
            "Buying greenhouse for tomatoes", "School uniform and books",
            "Expanding fish pond business", "Buying sewing machines for tailoring",
            "Starting posho mill business", "Purchasing water tank for business"
        ] * 5
        
        # Member comments
        member_comments = [
            "Thank you for approving my loan quickly", "Requesting loan statement for 2024",
            "When is the next AGM meeting?", "Facing drought affecting my farm repayments",
            "My grocery business is doing well thanks to SACCO", "Need 3-month extension for repayment",
            "Interested in taking education loan", "Appreciate the financial literacy training",
            "MPesa payments not going through", "When will annual dividends be distributed?",
            "Lost my passbook, need replacement", "Changing my mobile number",
            "Want to increase my monthly contributions", "Loan helped me buy school van",
            "Defaulted due to COVID pandemic", "Repayment completed successfully",
            "Need to withdraw some savings", "When is next loan application window?",
            "Business affected by floods", "Thank you for the Christmas bonus"
        ] * 5
        
        members_list = members_df.to_dict('records')
        
        for member in tqdm(members_list):
            # More notifications for active members
            if member['status'] == 'Active':
                num_notifications = random.randint(5, 15)
            else:
                num_notifications = random.randint(1, 5)
            
            join_date = datetime.strptime(member['joinDate'], '%Y-%m-%d')
            
            for i in range(num_notifications):
                notif_date = join_date + timedelta(days=random.randint(10, min(365*3, (datetime.now() - join_date).days)))
                
                # Mix of loan applications and general comments
                if random.random() < 0.5:  # 50% loan applications
                    message = random.choice(loan_purposes)
                    notif_type = 'Loan Application'
                else:
                    message = random.choice(member_comments)
                    notif_type = 'Member Feedback'
                
                notifications.append({
                    'id': str(uuid.uuid4()),
                    'member_id': member['id'],
                    'type': notif_type,
                    'messageContent': message,
                    'sendDate': notif_date.strftime('%Y-%m-%d'),
                    'channel': random.choice(['SMS', 'Mobile App', 'Email', 'WhatsApp', 'Meeting']),
                    'created_by': 'system',
                    'modified_by': 'system',
                    'created_on': notif_date.strftime('%Y-%m-%d %H:%M:%S'),
                    'modified_on': notif_date.strftime('%Y-%m-%d %H:%M:%S'),
                    'mansoft_tenant_id': 'tenant_001'
                })
        
        return pd.DataFrame(notifications)
    
    def generate_all_data(self):
        """Generate all data at SACCO scale"""
        print("=" * 60)
        print("🏢 GENERATING REAL SACCO-SCALE DATA FOR ML TRAINING")
        print("=" * 60)
        
        # Generate data
        members_df = self.generate_members()
        
        contributions_df = self.generate_contributions(members_df)
        
        loans_df = self.generate_loans(members_df, contributions_df)
        
        notifications_df = self.generate_notifications(members_df, loans_df)
        
        # Save to CSV
        print("\n💾 Saving data to CSV files...")
        members_df.to_csv('data/members_ml_training.csv', index=False)
        contributions_df.to_csv('data/contributions_ml_training.csv', index=False)
        loans_df.to_csv('data/loans_ml_training.csv', index=False)
        notifications_df.to_csv('data/member_comments_ml_training.csv', index=False)
        
        # Statistics
        print("\n" + "=" * 60)
        print("📊 FINAL DATA STATISTICS")
        print("=" * 60)
        print(f"👥 Members: {len(members_df):,} total")
        print(f"💰 Contributions: {len(contributions_df):,} transactions")
        print(f"🏦 Loans: {len(loans_df):,} loans")
        print(f"📱 Notifications: {len(notifications_df):,} messages")
        
        # Detailed stats
        active_members = len(members_df[members_df['status'] == 'Active'])
        print(f"\n📈 Active Members: {active_members:,} ({active_members/len(members_df)*100:.1f}%)")
        
        if len(loans_df) > 0:
            total_loans = loans_df['amount'].sum()
            avg_loan = loans_df['amount'].mean()
            print(f"📊 Total Loan Volume: KES {total_loans:,.0f}")
            print(f"📊 Average Loan Size: KES {avg_loan:,.0f}")
            
            defaults = len(loans_df[loans_df['status'] == 'Defaulted'])
            default_rate = defaults / len(loans_df) * 100
            print(f"⚠️  Defaults: {defaults:,} loans ({default_rate:.1f}% default rate)")
        
        total_savings = contributions_df[
            (contributions_df['transactionType'] == 'Contribution') & 
            (contributions_df['status'] == 'Completed')
        ]['amount'].sum()
        print(f"💰 Total Savings: KES {total_savings:,.0f}")
        
        print("\n✅ Data generation complete! Ready for ML training.")
        print("📁 Files saved to data/ folder")

if __name__ == "__main__":
    # Install tqdm if not present
    try:
        from tqdm import tqdm
    except ImportError:
        print("Installing tqdm for progress bars...")
        import subprocess
        subprocess.check_call(["pip", "install", "tqdm"])
        from tqdm import tqdm
    
    generator = LargeSaccoDataGenerator()
    generator.generate_all_data()