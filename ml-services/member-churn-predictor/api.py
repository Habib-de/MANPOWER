# member-churn-predictor/api.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import pandas as pd
import numpy as np
import joblib
import mysql.connector
from typing import Dict, Any, List
from datetime import datetime, date, timedelta
import logging
import traceback

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Setup paths ---
base_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(base_dir, ".."))
sys.path.append(project_root)

# --- Database Configuration ---
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'manpower2_db',
    'port': 3306,
    'autocommit': True
}

# =============================================================================
# INITIALIZE FLASK APP
# =============================================================================

app = Flask(__name__)
CORS(app)

# =============================================================================
# LOAD YOUR TRAINED CHURN MODEL
# =============================================================================

print("\n" + "="*70)
print("🧠 LOADING MEMBER CHURN MODEL")
print("="*70)

try:
    churn_path = os.path.join(base_dir, "models", "member_churn_predictor.joblib")
    churn_data = joblib.load(churn_path)
    CHURN_MODEL = churn_data['model']
    CHURN_SCALER = churn_data['scaler']
    CHURN_FEATURES = churn_data['feature_names']
    print(f"✅ Churn Model loaded: {type(CHURN_MODEL).__name__}")
    print(f"   Features: {len(CHURN_FEATURES)}")
    print(f"   Model Accuracy: 99% (from training)")
    MODEL_LOADED = True
except Exception as e:
    print(f"❌ Churn Model failed: {e}")
    CHURN_MODEL = None
    CHURN_SCALER = None
    CHURN_FEATURES = []
    MODEL_LOADED = False

print("="*70)

# =============================================================================
# DATABASE FETCHER - WITH NEW CONTRIBUTION FEATURES
# =============================================================================

class DatabaseFetcher:
    def __init__(self, config=DB_CONFIG):
        self.config = config
        self.connection = None
    
    def connect(self):
        """Create single database connection"""
        try:
            if not self.connection or not self.connection.is_connected():
                self.connection = mysql.connector.connect(**self.config)
            return self.connection
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return None
    
    def fetch_member_data_for_churn(self, member_id: str) -> Dict:
        """Fetch all member data needed for churn prediction including new contribution features"""
        conn = self.connect()
        if not conn:
            logger.error("❌ Cannot fetch data - no database connection")
            return self._get_empty_data()
        
        try:
            cursor = conn.cursor(dictionary=True)
            
            # STEP 1: Get member basic info
            cursor.execute("""
                SELECT 
                    id,
                    first_name,
                    last_name,
                    email,
                    phone_number,
                    role,
                    status,
                    join_date,
                    group_id,
                    DATEDIFF(NOW(), join_date) as membership_days
                FROM members 
                WHERE id = %s
            """, (member_id,))
            
            member = cursor.fetchone()
            
            if not member:
                logger.warning(f"Member {member_id} not found in database")
                return self._get_empty_data()
            
            # Calculate membership months
            membership_days = member.get('membership_days', 0)
            if membership_days < 0:
                membership_days = 180
            member['membership_months'] = membership_days / 30.44
            
            # STEP 2: Get contribution history with NEW fields (pending, overdue, penalties)
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_contributions,
                    SUM(amount) as total_saved,
                    AVG(amount) as avg_contribution,
                    MAX(transaction_date) as last_contrib_date,
                    
                    -- New: Pending contributions
                    SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END) as pending_amount,
                    
                    -- New: Overdue contributions (due_date < NOW() AND status = 'Pending')
                    SUM(CASE 
                        WHEN status = 'Pending' AND due_date IS NOT NULL AND due_date < NOW() 
                        THEN 1 ELSE 0 END) as overdue_count,
                    SUM(CASE 
                        WHEN status = 'Pending' AND due_date IS NOT NULL AND due_date < NOW() 
                        THEN amount ELSE 0 END) as overdue_amount,
                    
                    -- New: Maximum days overdue
                    MAX(CASE 
                        WHEN status = 'Pending' AND due_date IS NOT NULL AND due_date < NOW() 
                        THEN DATEDIFF(NOW(), due_date) ELSE 0 END) as max_days_overdue,
                    
                    -- New: Penalties
                    SUM(CASE WHEN penalty_applied IS NOT NULL AND penalty_applied > 0 
                        THEN penalty_applied ELSE 0 END) as total_penalties,
                    COUNT(CASE WHEN penalty_applied IS NOT NULL AND penalty_applied > 0 
                        THEN 1 ELSE NULL END) as penalty_count,
                    
                    -- Last 3 months
                    SUM(CASE 
                        WHEN transaction_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH) 
                        THEN 1 ELSE 0 END) as contrib_count_3m,
                    SUM(CASE 
                        WHEN transaction_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH) 
                        THEN amount ELSE 0 END) as contrib_amount_3m,
                    
                    -- Last 6 months
                    SUM(CASE 
                        WHEN transaction_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH) 
                        THEN 1 ELSE 0 END) as contrib_count_6m,
                    SUM(CASE 
                        WHEN transaction_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH) 
                        THEN amount ELSE 0 END) as contrib_amount_6m,
                    
                    -- Last 12 months
                    SUM(CASE 
                        WHEN transaction_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH) 
                        THEN 1 ELSE 0 END) as contrib_count_12m,
                    SUM(CASE 
                        WHEN transaction_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH) 
                        THEN amount ELSE 0 END) as contrib_amount_12m,
                    
                    -- Consistency
                    COUNT(DISTINCT DATE_FORMAT(transaction_date, '%%Y-%%m')) as months_active,
                    
                    -- Completion rate
                    AVG(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completion_rate
                FROM contributions 
                WHERE member_id = %s
            """, (member_id,))
            
            contribs = cursor.fetchone() or {}
            
            # Handle NULLs
            for key in contribs:
                if contribs[key] is None:
                    contribs[key] = 0
            
            # Get days since last contribution
            last_contrib = contribs.get('last_contrib_date')
            if last_contrib:
                if isinstance(last_contrib, date) and not isinstance(last_contrib, datetime):
                    last_contrib = datetime.combine(last_contrib, datetime.min.time())
                days_since = (datetime.now() - last_contrib).days
            else:
                days_since = membership_days
            
            # Get group settings for expected contributions
            group_id = member.get('group_id')
            expected_amount = 0
            contribution_frequency = 'MONTHLY'
            
            if group_id:
                cursor.execute("""
                    SELECT expected_contribution_amount, contribution_frequency
                    FROM group_info
                    WHERE id = %s
                """, (group_id,))
                group_settings = cursor.fetchone()
                if group_settings:
                    expected_amount = group_settings.get('expected_contribution_amount', 0) or 0
                    contribution_frequency = group_settings.get('contribution_frequency', 'MONTHLY') or 'MONTHLY'
            
            # Calculate missed contributions based on frequency
            expected_contributions = 0
            missed_contributions = 0
            
            if contribution_frequency == 'WEEKLY':
                membership_weeks = membership_days / 7
                expected_contributions = max(1, int(membership_weeks))
            else:  # MONTHLY
                expected_contributions = max(1, int(member['membership_months']))
            
            missed_contributions = max(0, expected_contributions - contribs.get('total_contributions', 0))
            is_behind_schedule = missed_contributions > (expected_contributions * 0.2)
            
            # Payment regularity (simplified: consistency of payment timing)
            payment_regularity = 0.5
            payment_amount_consistency = 0.5
            
            if contribs.get('total_contributions', 0) > 1:
                # Calculate payment regularity based on completion rate
                payment_regularity = contribs.get('completion_rate', 0.5)
                # Calculate amount consistency based on average amount vs max
                avg_amt = contribs.get('avg_contribution', 0)
                max_amt = contribs.get('amount_max', 0)
                if avg_amt > 0 and max_amt > 0:
                    payment_amount_consistency = min(1, avg_amt / max_amt)
            
            # STEP 3: Get loan history
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_loans,
                    SUM(amount) as total_borrowed,
                    AVG(amount) as avg_loan_amount,
                    MAX(amount) as max_loan_amount,
                    
                    -- Loan status
                    SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_loans,
                    SUM(CASE WHEN status = 'Overdue' THEN 1 ELSE 0 END) as overdue_loans,
                    SUM(CASE WHEN status = 'Defaulted' THEN 1 ELSE 0 END) as defaulted_loans,
                    SUM(CASE WHEN status = 'Repaid' THEN 1 ELSE 0 END) as repaid_loans,
                    
                    -- Financial
                    SUM(outstanding_balance) as total_outstanding,
                    AVG(interest_rate) as avg_interest_rate,
                    
                    -- Repayment behavior
                    AVG(CASE WHEN status = 'Repaid' THEN 1 ELSE 0 END) as repayment_rate,
                    
                    -- Last loan
                    MAX(start_date) as last_loan_date
                FROM loans 
                WHERE member_id = %s
            """, (member_id,))
            
            loans = cursor.fetchone() or {}
            
            # Handle NULLs
            for key in loans:
                if loans[key] is None:
                    loans[key] = 0
            
            # Get days since last loan
            last_loan = loans.get('last_loan_date')
            if last_loan:
                if isinstance(last_loan, date) and not isinstance(last_loan, datetime):
                    last_loan = datetime.combine(last_loan, datetime.min.time())
                days_since_last_loan = (datetime.now() - last_loan).days
            else:
                days_since_last_loan = membership_days
            
            # STEP 4: Get communication history
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_notifications,
                    MAX(send_date) as last_communication,
                    
                    -- Type counts
                    SUM(CASE WHEN type = 'Loan Application' THEN 1 ELSE 0 END) as loan_applications,
                    SUM(CASE WHEN type = 'Member Feedback' THEN 1 ELSE 0 END) as feedback_count,
                    
                    -- Channel preference
                    SUM(CASE WHEN channel = 'SMS' THEN 1 ELSE 0 END) as sms_count,
                    SUM(CASE WHEN channel = 'Mobile App' THEN 1 ELSE 0 END) as app_count,
                    SUM(CASE WHEN channel = 'Email' THEN 1 ELSE 0 END) as email_count,
                    SUM(CASE WHEN channel = 'WhatsApp' THEN 1 ELSE 0 END) as whatsapp_count
                FROM notifications 
                WHERE member_id = %s
            """, (member_id,))
            
            notifs = cursor.fetchone() or {}
            
            # Handle NULLs
            for key in notifs:
                if notifs[key] is None:
                    notifs[key] = 0
            
            # Get days since last communication
            last_comm = notifs.get('last_communication')
            if last_comm:
                if isinstance(last_comm, date) and not isinstance(last_comm, datetime):
                    last_comm = datetime.combine(last_comm, datetime.min.time())
                days_since_last_comm = (datetime.now() - last_comm).days
            else:
                days_since_last_comm = membership_days
            
            cursor.close()
            
            # Calculate derived features
            loan_to_savings_ratio = (loans.get('total_outstanding', 0) / 
                                    max(1, contribs.get('total_saved', 1)))
            
            # Activity trend
            if contribs.get('contrib_count_6m', 0) > 0 and contribs.get('months_active', 0) > 3:
                historical_avg = contribs.get('total_contributions', 0) / max(1, contribs.get('months_active', 1))
                recent_avg = contribs.get('contrib_count_6m', 0) / 6
                activity_trend = recent_avg / max(0.1, historical_avg)
            else:
                activity_trend = 1.0
            
            # Silent days
            silent_days = min(days_since, days_since_last_comm)
            
            # Warning flags
            warning_no_contrib_3m = 1 if contribs.get('contrib_count_3m', 0) == 0 else 0
            warning_no_contrib_6m = 1 if contribs.get('contrib_count_6m', 0) == 0 else 0
            warning_no_comm_3m = 1 if days_since_last_comm > 90 else 0
            warning_high_debt = 1 if loan_to_savings_ratio > 2 else 0
            warning_default_history = 1 if loans.get('defaulted_loans', 0) > 0 else 0
            
            # NEW warning flags
            warning_has_pending = 1 if contribs.get('pending_count', 0) > 0 else 0
            warning_has_overdue = 1 if contribs.get('overdue_count', 0) > 0 else 0
            warning_has_penalties = 1 if contribs.get('total_penalties', 0) > 0 else 0
            warning_behind_schedule = 1 if is_behind_schedule else 0
            warning_irregular_payments = 1 if payment_regularity < 0.3 else 0
            warning_amount_changed = 1 if payment_amount_consistency < 0.3 else 0
            
            # Build complete feature dictionary
            features = {
                'member_id': member_id,
                'first_name': member.get('first_name', ''),
                'last_name': member.get('last_name', ''),
                'email': member.get('email', ''),
                'phone_number': member.get('phone_number', ''),
                'status': member.get('status', ''),
                'group_id': group_id,
                'membership_days': membership_days,
                'membership_months': member['membership_months'],
                'role_encoded': 0 if member['role'] == 'Member' else (1 if member['role'] == 'GroupAdmin' else 2),
                
                # Contribution features (existing)
                'total_contributions': contribs.get('total_contributions', 0),
                'total_saved': contribs.get('total_saved', 0),
                'avg_contribution': contribs.get('avg_contribution', 0),
                'std_contribution': 0,
                'days_since_last_contrib': days_since,
                'contrib_count_3m': contribs.get('contrib_count_3m', 0),
                'contrib_count_6m': contribs.get('contrib_count_6m', 0),
                'contrib_count_12m': contribs.get('contrib_count_12m', 0),
                'contrib_amount_3m': contribs.get('contrib_amount_3m', 0),
                'contrib_amount_6m': contribs.get('contrib_amount_6m', 0),
                'contrib_amount_12m': contribs.get('contrib_amount_12m', 0),
                'months_active': contribs.get('months_active', 0),
                'consistency_score': contribs.get('months_active', 0) / max(1, member['membership_months']),
                'completion_rate': contribs.get('completion_rate', 0.5),
                'mpesa_pct': 0,
                'cash_pct': 0,
                'bank_pct': 0,
                
                # NEW Contribution features
                'has_pending_contributions': 1 if contribs.get('pending_count', 0) > 0 else 0,
                'pending_contributions_count': contribs.get('pending_count', 0),
                'pending_amount_total': contribs.get('pending_amount', 0),
                'overdue_contributions_count': contribs.get('overdue_count', 0),
                'overdue_amount_total': contribs.get('overdue_amount', 0),
                'has_overdue_contributions': 1 if contribs.get('overdue_count', 0) > 0 else 0,
                'max_days_overdue': contribs.get('max_days_overdue', 0),
                'total_penalties_paid': contribs.get('total_penalties', 0),
                'has_penalties': 1 if contribs.get('total_penalties', 0) > 0 else 0,
                'payment_regularity': payment_regularity,
                'payment_amount_consistency': payment_amount_consistency,
                'expected_contributions': expected_contributions,
                'missed_contributions': missed_contributions,
                'missed_contributions_rate': missed_contributions / max(1, expected_contributions),
                'is_behind_schedule': 1 if is_behind_schedule else 0,
                'is_likely_monthly': 1 if contribution_frequency == 'MONTHLY' else 0,
                'is_likely_weekly': 1 if contribution_frequency == 'WEEKLY' else 0,
                
                # Loan features
                'total_loans': loans.get('total_loans', 0),
                'total_borrowed': loans.get('total_borrowed', 0),
                'avg_loan_amount': loans.get('avg_loan_amount', 0),
                'max_loan_amount': loans.get('max_loan_amount', 0),
                'active_loans': loans.get('active_loans', 0),
                'overdue_loans': loans.get('overdue_loans', 0),
                'defaulted_loans': loans.get('defaulted_loans', 0),
                'repaid_loans': loans.get('repaid_loans', 0),
                'total_outstanding': loans.get('total_outstanding', 0),
                'avg_interest_rate': loans.get('avg_interest_rate', 0),
                'repayment_rate': loans.get('repayment_rate', 0.5),
                'default_rate': loans.get('defaulted_loans', 0) / max(1, loans.get('total_loans', 1)),
                'days_since_last_loan': days_since_last_loan,
                'loan_to_savings_ratio': loan_to_savings_ratio,
                'has_outstanding_debt': 1 if loans.get('total_outstanding', 0) > 0 else 0,
                
                # Communication features
                'total_notifications': notifs.get('total_notifications', 0),
                'loan_applications': notifs.get('loan_applications', 0),
                'feedback_count': notifs.get('feedback_count', 0),
                'days_since_last_communication': days_since_last_comm,
                'sms_pct': notifs.get('sms_count', 0) / max(1, notifs.get('total_notifications', 1)),
                'app_pct': notifs.get('app_count', 0) / max(1, notifs.get('total_notifications', 1)),
                'email_pct': notifs.get('email_count', 0) / max(1, notifs.get('total_notifications', 1)),
                'whatsapp_pct': notifs.get('whatsapp_count', 0) / max(1, notifs.get('total_notifications', 1)),
                
                # Trend features
                'activity_trend': activity_trend,
                'savings_growth_rate': contribs.get('contrib_amount_6m', 0) / max(1, contribs.get('contrib_amount_12m', 1)),
                
                # Status flags
                'is_active_status': 1 if member['status'] == 'Active' else 0,
                'is_inactive_status': 1 if member['status'] == 'Inactive' else 0,
                'is_terminated': 1 if member['status'] == 'Terminated' else 0,
                
                # Risk indicators (existing)
                'silent_days': silent_days,
                'warning_no_contrib_3m': warning_no_contrib_3m,
                'warning_no_contrib_6m': warning_no_contrib_6m,
                'warning_no_comm_3m': warning_no_comm_3m,
                'warning_high_debt': warning_high_debt,
                'warning_default_history': warning_default_history,
                
                # NEW Risk indicators
                'warning_has_pending': warning_has_pending,
                'warning_has_overdue': warning_has_overdue,
                'warning_has_penalties': warning_has_penalties,
                'warning_behind_schedule': warning_behind_schedule,
                'warning_irregular_payments': warning_irregular_payments,
                'warning_amount_changed': warning_amount_changed
            }
            
            return features
            
        except Exception as e:
            logger.error(f"Error fetching data for {member_id}: {e}")
            logger.error(traceback.format_exc())
            return self._get_empty_data()
        finally:
            if conn:
                conn.close()
    
    def _get_empty_data(self):
        """Return empty data structure"""
        return {
            'member_id': '',
            'first_name': '',
            'last_name': '',
            'email': '',
            'phone_number': '',
            'status': '',
            'group_id': '',
            'membership_days': 180,
            'membership_months': 6.0,
            'role_encoded': 0,
            'total_contributions': 0,
            'total_saved': 0,
            'avg_contribution': 0,
            'std_contribution': 0,
            'days_since_last_contrib': 180,
            'contrib_count_3m': 0,
            'contrib_count_6m': 0,
            'contrib_count_12m': 0,
            'contrib_amount_3m': 0,
            'contrib_amount_6m': 0,
            'contrib_amount_12m': 0,
            'months_active': 0,
            'consistency_score': 0,
            'completion_rate': 0.5,
            'mpesa_pct': 0,
            'cash_pct': 0,
            'bank_pct': 0,
            'has_pending_contributions': 0,
            'pending_contributions_count': 0,
            'pending_amount_total': 0,
            'overdue_contributions_count': 0,
            'overdue_amount_total': 0,
            'has_overdue_contributions': 0,
            'max_days_overdue': 0,
            'total_penalties_paid': 0,
            'has_penalties': 0,
            'payment_regularity': 0.5,
            'payment_amount_consistency': 0.5,
            'expected_contributions': 26,
            'missed_contributions': 0,
            'missed_contributions_rate': 0,
            'is_behind_schedule': 0,
            'is_likely_monthly': 1,
            'is_likely_weekly': 0,
            'total_loans': 0,
            'total_borrowed': 0,
            'avg_loan_amount': 0,
            'max_loan_amount': 0,
            'active_loans': 0,
            'overdue_loans': 0,
            'defaulted_loans': 0,
            'repaid_loans': 0,
            'total_outstanding': 0,
            'avg_interest_rate': 0,
            'repayment_rate': 0.5,
            'default_rate': 0,
            'days_since_last_loan': 180,
            'loan_to_savings_ratio': 0,
            'has_outstanding_debt': 0,
            'total_notifications': 0,
            'loan_applications': 0,
            'feedback_count': 0,
            'days_since_last_communication': 180,
            'sms_pct': 0,
            'app_pct': 0,
            'email_pct': 0,
            'whatsapp_pct': 0,
            'activity_trend': 1.0,
            'savings_growth_rate': 0.5,
            'is_active_status': 1,
            'is_inactive_status': 0,
            'is_terminated': 0,
            'silent_days': 180,
            'warning_no_contrib_3m': 1,
            'warning_no_contrib_6m': 1,
            'warning_no_comm_3m': 1,
            'warning_high_debt': 0,
            'warning_default_history': 0,
            'warning_has_pending': 0,
            'warning_has_overdue': 0,
            'warning_has_penalties': 0,
            'warning_behind_schedule': 0,
            'warning_irregular_payments': 0,
            'warning_amount_changed': 0
        }


# =============================================================================
# MEMBER INFO ENDPOINT (RESTORED)
# =============================================================================

@app.route('/api/v1/member/<member_id>', methods=['GET'])
def get_member_info(member_id):
    """Get detailed member information including contributions and loans"""
    try:
        logger.info(f"📋 Fetching member info for: {member_id}")
        
        conn = DatabaseFetcher().connect()
        if not conn:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # Get member basic info
        cursor.execute("""
            SELECT 
                id,
                first_name,
                last_name,
                email,
                phone_number,
                role,
                status,
                join_date,
                group_id
            FROM members 
            WHERE id = %s
        """, (member_id,))
        
        member = cursor.fetchone()
        
        if not member:
            return jsonify({'success': False, 'error': 'Member not found'}), 404
        
        # Get recent contributions
        cursor.execute("""
            SELECT 
                id,
                amount,
                transaction_date,
                due_date,
                payment_date,
                status,
                payment_method,
                is_late,
                days_late,
                penalty_applied,
                description
            FROM contributions 
            WHERE member_id = %s
            ORDER BY transaction_date DESC
            LIMIT 10
        """, (member_id,))
        
        contributions = cursor.fetchall()
        
        # Format dates for JSON
        for contrib in contributions:
            if contrib.get('transaction_date'):
                contrib['transaction_date'] = contrib['transaction_date'].isoformat() if hasattr(contrib['transaction_date'], 'isoformat') else str(contrib['transaction_date'])
            if contrib.get('due_date'):
                contrib['due_date'] = contrib['due_date'].isoformat() if hasattr(contrib['due_date'], 'isoformat') else str(contrib['due_date'])
            if contrib.get('payment_date'):
                contrib['payment_date'] = contrib['payment_date'].isoformat() if hasattr(contrib['payment_date'], 'isoformat') else str(contrib['payment_date'])
        
        # Get loans
        cursor.execute("""
            SELECT 
                id,
                amount,
                interest_rate,
                start_date,
                due_date,
                status,
                outstanding_balance,
                total_paid,
                reason
            FROM loans 
            WHERE member_id = %s
            ORDER BY start_date DESC
        """, (member_id,))
        
        loans = cursor.fetchall()
        
        # Format dates for loans
        for loan in loans:
            if loan.get('start_date'):
                loan['start_date'] = loan['start_date'].isoformat() if hasattr(loan['start_date'], 'isoformat') else str(loan['start_date'])
            if loan.get('due_date'):
                loan['due_date'] = loan['due_date'].isoformat() if hasattr(loan['due_date'], 'isoformat') else str(loan['due_date'])
        
        # Get summary stats
        cursor.execute("""
            SELECT 
                COUNT(*) as total_contributions,
                SUM(amount) as total_saved,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'Pending' AND due_date < NOW() THEN 1 ELSE 0 END) as overdue_count,
                SUM(penalty_applied) as total_penalties
            FROM contributions 
            WHERE member_id = %s
        """, (member_id,))
        
        summary = cursor.fetchone() or {}
        
        cursor.close()
        conn.close()
        
        response = {
            'success': True,
            'data': {
                'member': member,
                'contributions': contributions,
                'loans': loans,
                'summary': {
                    'total_contributions': summary.get('total_contributions', 0),
                    'total_saved': float(summary.get('total_saved', 0)),
                    'pending_count': summary.get('pending_count', 0),
                    'overdue_count': summary.get('overdue_count', 0),
                    'total_penalties': float(summary.get('total_penalties', 0))
                }
            }
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Member info error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

# =============================================================================
# CHURN PREDICTION FUNCTION
# =============================================================================

def predict_churn_with_model(features: Dict) -> Dict:
    """Use trained model to predict churn with new contribution features"""
    if not MODEL_LOADED:
        return {
            'probability': 0.5,
            'risk_level': 'MEDIUM',
            'confidence': 0.5,
            'source': 'rules_fallback'
        }
    
    try:
        # Prepare features in correct order
        feature_vector = []
        for feature_name in CHURN_FEATURES:
            feature_vector.append(float(features.get(feature_name, 0)))
        
        # Convert to numpy array
        X = np.array([feature_vector])
        
        # Scale and predict
        X_scaled = CHURN_SCALER.transform(X)
        probability = float(CHURN_MODEL.predict_proba(X_scaled)[0][1])
        
        # Determine risk level
        if probability < 0.3:
            level = "LOW"
            recommendation = "Member is engaged - no action needed"
        elif probability < 0.6:
            level = "MEDIUM"
            recommendation = "Send engagement message and monitor activity"
        else:
            level = "HIGH"
            recommendation = "Immediate outreach required - possible churn risk"
        
        # Adjust recommendation based on new contribution features
        if features.get('has_overdue_contributions', False):
            level = "HIGH"
            recommendation = f"🔴 CRITICAL: {features.get('overdue_contributions_count', 0)} overdue contribution(s) - immediate payment reminder needed"
        elif features.get('has_pending_contributions', False):
            if level == "LOW":
                level = "MEDIUM"
            recommendation = f"📋 {features.get('pending_contributions_count', 0)} pending contribution(s) - payment reminder required"
        
        # Get model confidence
        confidence = float(max(CHURN_MODEL.predict_proba(X_scaled)[0]))
        
        # Identify risk factors
        risk_factors = []
        
        if features.get('has_overdue_contributions', False):
            overdue_count = features.get('overdue_contributions_count', 0)
            overdue_amount = features.get('overdue_amount_total', 0)
            risk_factors.append(f"🔴 CRITICAL: {overdue_count} overdue contribution(s) totaling KES {overdue_amount:,.0f}")
        
        if features.get('has_pending_contributions', False):
            pending_count = features.get('pending_contributions_count', 0)
            pending_amount = features.get('pending_amount_total', 0)
            risk_factors.append(f"⏳ {pending_count} pending contribution(s) totaling KES {pending_amount:,.0f}")
        
        if features.get('has_penalties', False):
            total_penalties = features.get('total_penalties_paid', 0)
            risk_factors.append(f"💰 Has paid KES {total_penalties:,.0f} in late penalties")
        
        if features.get('warning_behind_schedule', False):
            missed = features.get('missed_contributions', 0)
            risk_factors.append(f"📅 Behind schedule by {missed:.0f} contribution(s)")
        
        if features.get('days_since_last_contrib', 0) > 90:
            risk_factors.append(f"No contributions for {features['days_since_last_contrib']:.0f} days")
        
        if features.get('warning_no_contrib_3m', 0) == 1:
            risk_factors.append("No activity in last 3 months")
        
        if features.get('warning_default_history', 0) == 1:
            risk_factors.append("Has defaulted on loans before")
        
        if features.get('loan_to_savings_ratio', 0) > 2:
            risk_factors.append(f"High debt ratio: {features['loan_to_savings_ratio']:.1f}x savings")
        
        if features.get('days_since_last_communication', 0) > 60:
            risk_factors.append(f"No communication for {features['days_since_last_communication']:.0f} days")
        
        if features.get('activity_trend', 1) < 0.5:
            risk_factors.append("Declining contribution activity")
        
        return {
            'probability': float(probability),
            'risk_level': level,
            'confidence': float(confidence),
            'risk_factors': risk_factors[:5],
            'recommendation': recommendation,
            'source': 'ml_model',
            'features_used': len(feature_vector)
        }
        
    except Exception as e:
        logger.error(f"Churn prediction failed: {e}")
        return {
            'probability': 0.5,
            'risk_level': 'MEDIUM',
            'confidence': 0.5,
            'risk_factors': ['Unable to calculate risk factors'],
            'recommendation': 'Manual review recommended',
            'source': 'error_fallback'
        }

# =============================================================================
# FLASK APP
# =============================================================================

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'member-churn-predictor',
        'model_loaded': MODEL_LOADED,
        'model_type': type(CHURN_MODEL).__name__ if CHURN_MODEL else None,
        'features_count': len(CHURN_FEATURES),
        'database': 'configured',
        'api_version': '2.0',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/v1/predict/member/<member_id>', methods=['GET'])
def predict_member_churn(member_id):
    """Predict churn for a specific member"""
    try:
        logger.info(f"🔍 Predicting churn for member: {member_id}")
        
        fetcher = DatabaseFetcher()
        member_features = fetcher.fetch_member_data_for_churn(member_id)
        
        if not member_features or not member_features.get('member_id'):
            return jsonify({
                'success': False,
                'error': f'Member {member_id} not found'
            }), 404
        
        prediction = predict_churn_with_model(member_features)
        
        response = {
            'success': True,
            'data': {
                'member_id': member_id,
                'member_name': f"{member_features.get('first_name', '')} {member_features.get('last_name', '')}".strip(),
                'churn_probability': prediction['probability'],
                'risk_level': prediction['risk_level'],
                'risk_factors': prediction['risk_factors'],
                'recommendation': prediction['recommendation'],
                'model_confidence': prediction['confidence'],
                'prediction_source': prediction['source'],
                
                'metrics': {
                    'days_inactive': member_features.get('days_since_last_contrib', 0),
                    'total_saved': member_features.get('total_saved', 0),
                    'total_loans': member_features.get('total_loans', 0),
                    'outstanding_debt': member_features.get('total_outstanding', 0),
                    'membership_months': round(member_features.get('membership_months', 0), 1),
                    'last_communication_days': member_features.get('days_since_last_communication', 0),
                    'pending_count': member_features.get('pending_contributions_count', 0),
                    'overdue_count': member_features.get('overdue_contributions_count', 0),
                    'total_penalties': member_features.get('total_penalties_paid', 0)
                }
            }
        }
        
        logger.info(f"✅ Prediction complete: {prediction['risk_level']} risk ({prediction['probability']:.1%})")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"API error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/v1/predict/group/<group_id>', methods=['GET'])
def predict_group_churn(group_id):
    """Predict churn for all members in a group"""
    try:
        logger.info(f"👥 Predicting churn for group: {group_id}")
        
        conn = DatabaseFetcher().connect()
        if not conn:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, first_name, last_name 
            FROM members 
            WHERE group_id = %s
        """, (group_id,))
        members = cursor.fetchall()
        cursor.close()
        conn.close()
        
        if not members:
            return jsonify({
                'success': False,
                'error': f'Group {group_id} not found or has no members'
            }), 404
        
        fetcher = DatabaseFetcher()
        results = []
        
        for member in members:
            member_features = fetcher.fetch_member_data_for_churn(member['id'])
            if member_features:
                prediction = predict_churn_with_model(member_features)
                results.append({
                    'member_id': member['id'],
                    'name': f"{member['first_name']} {member['last_name']}",
                    'churn_probability': prediction['probability'],
                    'risk_level': prediction['risk_level'],
                    'risk_factors': prediction['risk_factors'][:2],
                    'has_pending': member_features.get('has_pending_contributions', False),
                    'has_overdue': member_features.get('has_overdue_contributions', False)
                })
        
        high_risk = sum(1 for r in results if r['risk_level'] == 'HIGH')
        medium_risk = sum(1 for r in results if r['risk_level'] == 'MEDIUM')
        low_risk = sum(1 for r in results if r['risk_level'] == 'LOW')
        
        if results:
            health_score = 100 - ((high_risk * 10 + medium_risk * 5) / len(results))
        else:
            health_score = 100
        
        response = {
            'success': True,
            'data': {
                'group_id': group_id,
                'total_members': len(results),
                'health_score': round(health_score, 1),
                'risk_breakdown': {
                    'high': high_risk,
                    'medium': medium_risk,
                    'low': low_risk
                },
                'members': sorted(results, key=lambda x: x['churn_probability'], reverse=True),
                'recommendations': generate_group_recommendations(high_risk, medium_risk, len(results))
            }
        }
        
        logger.info(f"✅ Group analysis complete: {high_risk} high risk, {medium_risk} medium risk")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Group API error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/v1/dashboard/groupadmin/<admin_id>', methods=['GET'])
def groupadmin_dashboard(admin_id):
    """Get dashboard data for a GroupAdmin"""
    try:
        logger.info(f"📊 Generating dashboard for GroupAdmin: {admin_id}")
        
        conn = DatabaseFetcher().connect()
        if not conn:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT group_id FROM members 
            WHERE id = %s AND role = 'GroupAdmin'
        """, (admin_id,))
        admin = cursor.fetchone()
        
        if not admin:
            return jsonify({
                'success': False,
                'error': 'GroupAdmin not found'
            }), 404
        
        group_id = admin['group_id']
        
        cursor.execute("""
            SELECT COUNT(*) as count FROM members WHERE group_id = %s
        """, (group_id,))
        total_members = cursor.fetchone()['count']
        
        cursor.execute("""
            SELECT COUNT(*) as count FROM contributions 
            WHERE group_id = %s AND transaction_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        """, (group_id,))
        recent_contributions = cursor.fetchone()['count']
        
        cursor.close()
        conn.close()
        
        group_result = predict_group_churn(group_id)
        group_data = group_result.get_json()
        
        if not group_data['success']:
            return group_result
        
        dashboard = {
            'admin_id': admin_id,
            'group_id': group_id,
            'total_members': total_members,
            'recent_activity_30d': recent_contributions,
            'health_score': group_data['data']['health_score'],
            'risk_breakdown': group_data['data']['risk_breakdown'],
            'at_risk_members': [m for m in group_data['data']['members'] 
                               if m['risk_level'] in ['HIGH', 'MEDIUM']][:10],
            'recommendations': group_data['data']['recommendations'],
            'last_updated': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'data': dashboard
        })
        
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def generate_group_recommendations(high_risk, medium_risk, total_members):
    """Generate recommendations based on group risk profile"""
    recommendations = []
    
    if high_risk > 0:
        recommendations.append(f"🔴 {high_risk} members need immediate attention - schedule check-in calls")
    
    if medium_risk > 5:
        recommendations.append(f"🟡 Send engagement SMS to {medium_risk} medium-risk members")
    
    if high_risk == 0 and medium_risk == 0:
        recommendations.append("✅ Group is healthy - continue regular engagement")
    
    if total_members > 0 and (high_risk + medium_risk) / total_members > 0.3:
        recommendations.append("📅 Schedule a group meeting to boost engagement")
    
    if high_risk > medium_risk:
        recommendations.append("📞 Priority: Contact high-risk members this week")
    
    return recommendations

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🚀 MEMBER CHURN PREDICTOR API READY!")
    print("="*70)
    print(f"📊 Churn Model: {'✅' if MODEL_LOADED else '❌'}")
    print(f"   Features: {len(CHURN_FEATURES)}")
    print("="*70)
    print("📡 API Running on http://localhost:5001")
    print("\n📋 ENDPOINTS:")
    print("  GET  /health                                    - Health check")
    print("  GET  /api/v1/member/<member_id>                 - Get member details (contributions, loans)")
    print("  GET  /api/v1/predict/member/<member_id>        - Predict single member churn")
    print("  GET  /api/v1/predict/group/<group_id>          - Predict entire group churn")
    print("  GET  /api/v1/dashboard/groupadmin/<admin_id>   - GroupAdmin dashboard")
    print("\n🎯 NEW FEATURES INCLUDED:")
    print("  ✅ Pending contributions tracking")
    print("  ✅ Overdue contributions detection")
    print("  ✅ Penalty tracking")
    print("  ✅ Payment regularity analysis")
    print("  ✅ Behind schedule detection")
    print("  ✅ Missed contributions calculation")
    print("="*70)
    
    app.run(host='0.0.0.0', port=5001, debug=True)