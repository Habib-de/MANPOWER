# loan-eligibility-predictor/model.py - CORRECTED VERSION
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error
import joblib
import os
from datetime import datetime
from typing import Tuple, List, Dict, Optional


class LoanEligibilityPredictor:
    def __init__(self, 
                 data_dir: str = '../data',
                 model_dir: str = 'models',
                 reference_date: Optional[datetime] = None,
                 min_eligibility: float = 5000,
                 max_eligibility: float = 150000,
                 new_member_cap: float = 30000,
                 min_membership_months: float = 6):
        """
        Initialize predictor with configurable parameters.
        
        Args:
            data_dir: Path to data files (relative to script location)
            model_dir: Path to save/load model files
            reference_date: Fixed date for calculations (default: now)
            min_eligibility: Minimum loan amount
            max_eligibility: Maximum loan amount
            new_member_cap: Cap for members under min_membership_months
            min_membership_months: Months threshold for "new member" status
        """
        self.model = RandomForestRegressor(
            n_estimators=150,
            random_state=42,
            max_depth=12,
            min_samples_split=10,
            min_samples_leaf=4,
            max_features=0.7,
            bootstrap=True,
            n_jobs=-1  # Use all CPU cores
        )
        self.is_trained = False
        self.data_dir = data_dir
        self.model_dir = model_dir
        self.reference_date = reference_date or datetime.now()
        self.min_eligibility = min_eligibility
        self.max_eligibility = max_eligibility
        self.new_member_cap = new_member_cap
        self.min_membership_months = min_membership_months
        
        # Feature names defined once, used everywhere
        self.feature_names = [
            'membership_months', 'is_active', 'contribution_count',
            'avg_contribution', 'total_contributed', 'completion_rate',
            'loan_count', 'avg_loan_amount', 'repayment_rate', 'avg_outstanding'
        ]
        
        # Business rule multipliers (configurable)
        self.savings_multipliers = {
            36: 2.0,   # 3+ years
            24: 1.5,   # 2-3 years
            12: 1.2,   # 1-2 years
            6: 0.8,    # 6-12 months
            0: 0.5     # 0-6 months
        }
        
        self.repayment_adjustments = {
            (0.8, float('inf')): 1.2,   # Excellent: >80%
            (0.6, 0.8): 1.1,            # Good: 60-80%
            (0.5, 0.6): 1.0,            # Average: 50-60% (no change)
            (0.3, 0.5): 0.8,            # Below average: 30-50%
            (0.0, 0.3): 0.7             # Poor: <30%
        }

    def load_data(self) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """Load data from CSV files with consistent path handling."""
        print("📊 Loading data for loan eligibility prediction...")
        
        # Resolve path relative to script location
        script_dir = os.path.dirname(os.path.abspath(__file__))
        data_path = os.path.join(script_dir, self.data_dir)
        
        members_file = os.path.join(data_path, 'members_ml_training.csv')
        contributions_file = os.path.join(data_path, 'contributions_ml_training.csv')
        loans_file = os.path.join(data_path, 'loans_ml_training.csv')
        
        try:
            members = pd.read_csv(members_file)
            contributions = pd.read_csv(contributions_file)
            loans = pd.read_csv(loans_file)
            
            print(f"✅ Loaded: {len(members):,} members, {len(contributions):,} contributions, {len(loans):,} loans")
            return members, contributions, loans
            
        except FileNotFoundError as e:
            self._diagnose_path_issues(data_path, e)
            raise

    def _diagnose_path_issues(self, data_path: str, original_error: Exception):
        """Helper to diagnose file path problems."""
        print(f"❌ Error loading data: {original_error}")
        print(f"💡 Looking in: {os.path.abspath(data_path)}")
        
        if os.path.exists(data_path):
            print(f"📂 Data folder exists. Files found:")
            for file in os.listdir(data_path):
                print(f"   - {file}")
        else:
            print(f"❌ Data folder does not exist: {data_path}")
            # Check parent directories
            parent = os.path.dirname(data_path)
            if os.path.exists(parent):
                print(f"📂 Parent directory exists. Contents:")
                for item in os.listdir(parent):
                    print(f"   - {item}")

    def prepare_features(self, members: pd.DataFrame, 
                        contributions: pd.DataFrame, 
                        loans: pd.DataFrame) -> Tuple[np.ndarray, List]:
        """
        Prepare features using ONLY available database columns.
        
        Returns:
            Tuple of (feature_matrix, member_ids)
        """
        print("🔄 Preparing features from database schema...")
        
        members = members.copy()
        members['joinDate'] = pd.to_datetime(members['joinDate'])
        ref_date = pd.Timestamp(self.reference_date)
        members['membership_days'] = (ref_date - members['joinDate']).dt.days
        members['membership_months'] = members['membership_days'] / 30.44  # More accurate avg
        
        # Member status
        members['is_active'] = (members['status'] == 'Active').astype(int)
        
        # Contribution patterns
        contribution_features = contributions.groupby('member_id').agg({
            'amount': ['count', 'mean', 'sum'],
            'status': lambda x: (x == 'Completed').mean()
        }).round(2)
        
        contribution_features.columns = ['contribution_count', 'avg_contribution', 
                                        'total_contributed', 'completion_rate']
        contribution_features = contribution_features.reset_index()
        
        # Loan history
        loan_features = loans.groupby('member_id').agg({
            'amount': ['count', 'mean'],
            'status': lambda x: (x == 'Repaid').mean(),
            'outstandingBalance': 'mean'
        }).round(2)
        
        loan_features.columns = ['loan_count', 'avg_loan_amount', 
                                'repayment_rate', 'avg_outstanding']
        loan_features = loan_features.reset_index()
        
        # Merge all features
        features_df = members[['id', 'membership_months', 'is_active']].copy()
        features_df = features_df.merge(contribution_features, left_on='id', 
                                       right_on='member_id', how='left')
        features_df = features_df.merge(loan_features, left_on='id', 
                                       right_on='member_id', how='left')
        
        # Fill NaN values with sensible defaults
        fill_values = {
            'repayment_rate': 0.5,
            'completion_rate': 0.5,
            'contribution_count': 0,
            'loan_count': 0,
            'avg_contribution': 0,
            'total_contributed': 0,
            'avg_loan_amount': 0,
            'avg_outstanding': 0
        }
        
        for col, default_val in fill_values.items():
            if col in features_df.columns:
                features_df[col] = features_df[col].fillna(default_val)
        
        # Ensure all expected columns exist
        for col in self.feature_names:
            if col not in features_df.columns:
                features_df[col] = 0
        
        features = features_df[self.feature_names].values
        member_ids = features_df['id'].tolist()
        
        print(f"✅ Feature matrix shape: {features.shape}")
        return features, member_ids

    def _get_savings_multiplier(self, months: float) -> float:
        """Get savings multiplier based on membership duration."""
        for threshold, multiplier in sorted(self.savings_multipliers.items(), reverse=True):
            if months >= threshold:
                return multiplier
        return 0.5

    def _get_repayment_adjustment(self, rate: float) -> float:
        """Get repayment rate adjustment factor."""
        for (low, high), adjustment in self.repayment_adjustments.items():
            if low <= rate < high:
                return adjustment
        return 1.0

    def calculate_eligibility_labels(self, members: pd.DataFrame,
                                    contributions: pd.DataFrame,
                                    loans: pd.DataFrame) -> np.ndarray:
        """Calculate REAL eligibility based on SACCO lending rules."""
        print("🎯 Calculating REAL SACCO eligibility labels...")
        
        labels = []
        ref_date = pd.Timestamp(self.reference_date)
        
        for _, member in members.iterrows():
            member_id = member['id']
            join_date = pd.to_datetime(member['joinDate'])
            months_member = (ref_date - join_date).days / 30.44
            status = member['status']
            
            # Get total savings (completed contributions)
            member_contribs = contributions[
                (contributions['member_id'] == member_id) &
                (contributions['transactionType'] == 'Contribution') &
                (contributions['status'] == 'Completed')
            ]
            total_savings = member_contribs['amount'].sum()
            
            # Get loan repayment history
            member_loans = loans[loans['member_id'] == member_id]
            
            if len(member_loans) > 0:
                repaid_loans = member_loans[member_loans['status'] == 'Repaid']
                repayment_rate = len(repaid_loans) / len(member_loans)
                
                # Proven capacity from largest repaid loan
                proven_capacity = repaid_loans['amount'].max() * 1.2 if len(repaid_loans) > 0 else 0
            else:
                repayment_rate = 0.5
                proven_capacity = 0
            
            # Calculate eligibility
            if status != 'Active':
                eligibility = 0
            else:
                # Savings-based eligibility
                savings_multiplier = self._get_savings_multiplier(months_member)
                savings_based = total_savings * savings_multiplier
                
                # Take maximum of savings-based or proven capacity
                eligibility = max(savings_based, proven_capacity)
                
                # Apply repayment history adjustment
                eligibility *= self._get_repayment_adjustment(repayment_rate)
            
            # Apply caps
            if months_member < self.min_membership_months:
                eligibility = min(eligibility, self.new_member_cap)
            
            eligibility = max(self.min_eligibility, min(self.max_eligibility, eligibility))
            eligibility = round(eligibility / 1000) * 1000
            
            labels.append(eligibility)
        
        labels_array = np.array(labels)
        self._print_eligibility_stats(labels_array)
        return labels_array

    def _print_eligibility_stats(self, labels: np.ndarray):
        """Print distribution statistics for eligibility labels."""
        print(f"\n💰 Eligibility Statistics:")
        print(f"   Minimum: KES {labels.min():,.0f}")
        print(f"   Maximum: KES {labels.max():,.0f}")
        print(f"   Average: KES {labels.mean():,.0f}")
        print(f"   Median:  KES {np.median(labels):,.0f}")
        
        print(f"\n📊 Eligibility Distribution:")
        bins = [0, 20000, 50000, 100000, 150000, float('inf')]
        bin_labels = ['0-20k', '20k-50k', '50k-100k', '100k-150k', '150k+']
        
        for i in range(len(bins) - 1):
            count = ((labels >= bins[i]) & (labels < bins[i + 1])).sum()
            percentage = count / len(labels) * 100
            print(f"   {bin_labels[i]}: {count} members ({percentage:.1f}%)")

    def train(self, save_model: bool = True) -> Tuple[float, float]:
        """Train the loan eligibility model."""
        print("🤖 Training Loan Eligibility Predictor...")
        
        members, contributions, loans = self.load_data()
        X, member_ids = self.prepare_features(members, contributions, loans)
        y = self.calculate_eligibility_labels(members, contributions, loans)
        
        print(f"📊 Feature matrix shape: {X.shape}")
        print(f"📊 Target vector shape: {y.shape}")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Train model (NO SCALING needed for Random Forest)
        self.model.fit(X_train, y_train)
        
        # Evaluate
        y_pred_train = self.model.predict(X_train)
        y_pred_test = self.model.predict(X_test)
        
        train_r2 = r2_score(y_train, y_pred_train)
        test_r2 = r2_score(y_test, y_pred_test)
        train_mae = mean_absolute_error(y_train, y_pred_train)
        test_mae = mean_absolute_error(y_test, y_pred_test)
        
        print(f"✅ Model trained successfully!")
        print(f"📊 Training R² Score: {train_r2:.4f}")
        print(f"📊 Test R² Score: {test_r2:.4f}")
        print(f"📊 Training MAE: KES {train_mae:,.0f}")
        print(f"📊 Test MAE: KES {test_mae:,.0f}")
        
        self.is_trained = True
        
        if save_model:
            self.save_model()
        
        return train_r2, test_r2

    def predict(self, member_data: pd.DataFrame,
                contributions_data: pd.DataFrame,
                loans_data: pd.DataFrame) -> List[Dict]:
        """
        Predict loan eligibility for members.
        
        Raises:
            RuntimeError: If model is not trained and no saved model exists.
        """
        if not self.is_trained:
            try:
                self.load_model()
            except FileNotFoundError:
                raise RuntimeError(
                    "Model not trained and no saved model found. "
                    "Call train() first or provide a trained model file."
                )
        
        features, member_ids = self.prepare_features(
            member_data, contributions_data, loans_data
        )
        
        eligibility_amounts = self.model.predict(features)
        eligibility_amounts = np.clip(
            eligibility_amounts, self.min_eligibility, self.max_eligibility
        )
        
        results = []
        for i, member_id in enumerate(member_ids):
            results.append({
                'member_id': member_id,
                'eligible_amount': round(eligibility_amounts[i], 2),
                'eligible_amount_formatted': f"KES {eligibility_amounts[i]:,.0f}"
            })
        
        return results

    def save_model(self):
        """Save the trained model."""
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(script_dir, self.model_dir)
        os.makedirs(model_path, exist_ok=True)
        
        model_file = os.path.join(model_path, 'loan_eligibility_model.joblib')
        joblib.dump({
            'model': self.model,
            'feature_names': self.feature_names,
            'config': {
                'min_eligibility': self.min_eligibility,
                'max_eligibility': self.max_eligibility,
                'new_member_cap': self.new_member_cap,
                'min_membership_months': self.min_membership_months
            }
        }, model_file)
        print(f"💾 Model saved to {model_file}")

    def load_model(self):
        """Load a trained model."""
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_file = os.path.join(
            script_dir, self.model_dir, 'loan_eligibility_model.joblib'
        )
        
        try:
            model_data = joblib.load(model_file)
            self.model = model_data['model']
            self.feature_names = model_data['feature_names']
            
            # Restore config if saved
            if 'config' in model_data:
                config = model_data['config']
                self.min_eligibility = config.get('min_eligibility', self.min_eligibility)
                self.max_eligibility = config.get('max_eligibility', self.max_eligibility)
            
            self.is_trained = True
            print(f"📂 Model loaded successfully from {model_file}")
            
        except FileNotFoundError:
            print(f"❌ No saved model found at {model_file}")
            raise


if __name__ == "__main__":
    predictor = LoanEligibilityPredictor()
    predictor.train()