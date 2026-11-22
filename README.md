<div align="center">

# 💼 ManPower

**A full-stack SACCO / chama platform — contributions, loans, dividends, investments and meetings, with M-Pesa payments and an ML decision engine for loan scoring and member retention.**

![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)
![Java](https://img.shields.io/badge/Java_8-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Python](https://img.shields.io/badge/Python_3-3776AB?style=for-the-badge&logo=python&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)

</div>

---

## About

ManPower is a group finance platform for savings groups, chamas and SACCOs in Kenya. Members contribute regularly, borrow from the group pool, earn dividends, and attend meetings — all from a role-based back office. Every loan application is scored by a Python ML orchestrator (eligibility, default risk, purpose-risk) before approval, and every member is continuously scored for churn risk so admins can intervene early.

## Highlights

- 💳 **Group-scoped M-Pesa** — each group configures its own Daraja keys; STK Push is initiated per group and the callback is routed back via a cache keyed on the contribution ID
- 🏦 **Contributions & penalties** — configurable frequency, grace periods, penalty amounts and due dates
- 🤖 **ML loan decisions** — eligibility, default risk and loan-purpose NLP combined into one recommendation
- 📉 **Member churn prediction** — scores every member on activity, pending/overdue contributions and communication silence
- 📈 **Dividends & investments** — declarations, per-member payouts, portfolio tracking with maturity alerts
- 🎁 **Volunteer campaigns** — fundraisers with STK Push and cash-entry paths
- 🗓️ **Meetings, documents, notifications** — role-based, group-scoped
- 👥 **Roles** — SuperAdmin, GroupAdmin, Member

## Author
**Ahmed Abib** · [Portfolio](https://abib-ahmed-portfolio.onrender.com) · [LinkedIn](https://www.linkedin.com/in/ahmed-abib-5b37a5184)
