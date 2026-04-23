"""Migration endpoint to add missing columns to existing tables."""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/migrate", tags=["migrate"])


@router.post("/add-plural-form")
async def add_plural_form_column(db: AsyncSession = Depends(get_db)):
    """Add plural_form column to vocabulary_words table if it doesn't exist."""
    try:
        await db.execute(
            text(
                "ALTER TABLE vocabulary_words "
                "ADD COLUMN IF NOT EXISTS plural_form VARCHAR"
            )
        )
        await db.commit()
        return {"success": True, "message": "plural_form column added (or already exists)"}
    except Exception as e:
        logger.exception("Failed to add plural_form column")
        await db.rollback()
        return {"success": False, "error": str(e)}


@router.post("/add-category")
async def add_category_column(db: AsyncSession = Depends(get_db)):
    """Add category column to vocabulary_words table if it doesn't exist."""
    try:
        await db.execute(
            text(
                "ALTER TABLE vocabulary_words "
                "ADD COLUMN IF NOT EXISTS category VARCHAR"
            )
        )
        await db.commit()
        return {"success": True, "message": "category column added (or already exists)"}
    except Exception as e:
        logger.exception("Failed to add category column")
        await db.rollback()
        return {"success": False, "error": str(e)}