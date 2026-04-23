from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Grammar_rules(Base):
    __tablename__ = "grammar_rules"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    rule_name = Column(String, nullable=False)
    explanation_ru = Column(String, nullable=True)
    explanation_kz = Column(String, nullable=True)
    examples = Column(String, nullable=True)
    category = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)