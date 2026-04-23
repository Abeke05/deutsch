from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Vocabulary_words(Base):
    __tablename__ = "vocabulary_words"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    german_word = Column(String, nullable=False)
    plural_form = Column(String, nullable=True)
    part_of_speech = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    russian_translation = Column(String, nullable=True)
    kazakh_translation = Column(String, nullable=True)
    example_sentence = Column(String, nullable=True)
    category = Column(String, nullable=True)
    subcategories = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)