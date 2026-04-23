import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.vocabulary_words import Vocabulary_words

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Vocabulary_wordsService:
    """Service layer for Vocabulary_words operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Vocabulary_words]:
        """Create a new vocabulary_words"""
        try:
            if user_id:
                data['user_id'] = user_id
            obj = Vocabulary_words(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created vocabulary_words with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating vocabulary_words: {str(e)}")
            raise

    async def check_ownership(self, obj_id: int, user_id: str) -> bool:
        """Check if user owns this record"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            return obj is not None
        except Exception as e:
            logger.error(f"Error checking ownership for vocabulary_words {obj_id}: {str(e)}")
            return False

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None) -> Optional[Vocabulary_words]:
        """Get vocabulary_words by ID (user can only see their own records)"""
        try:
            query = select(Vocabulary_words).where(Vocabulary_words.id == obj_id)
            if user_id:
                query = query.where(Vocabulary_words.user_id == user_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching vocabulary_words {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of vocabulary_wordss (user can only see their own records)"""
        try:
            query = select(Vocabulary_words)
            count_query = select(func.count(Vocabulary_words.id))
            
            if user_id:
                query = query.where(Vocabulary_words.user_id == user_id)
                count_query = count_query.where(Vocabulary_words.user_id == user_id)
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Vocabulary_words, field):
                        query = query.where(getattr(Vocabulary_words, field) == value)
                        count_query = count_query.where(getattr(Vocabulary_words, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Vocabulary_words, field_name):
                        query = query.order_by(getattr(Vocabulary_words, field_name).desc())
                else:
                    if hasattr(Vocabulary_words, sort):
                        query = query.order_by(getattr(Vocabulary_words, sort))
            else:
                query = query.order_by(Vocabulary_words.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching vocabulary_words list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Vocabulary_words]:
        """Update vocabulary_words (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Vocabulary_words {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key) and key != 'user_id':
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated vocabulary_words {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating vocabulary_words {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        """Delete vocabulary_words (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Vocabulary_words {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted vocabulary_words {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting vocabulary_words {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Vocabulary_words]:
        """Get vocabulary_words by any field"""
        try:
            if not hasattr(Vocabulary_words, field_name):
                raise ValueError(f"Field {field_name} does not exist on Vocabulary_words")
            result = await self.db.execute(
                select(Vocabulary_words).where(getattr(Vocabulary_words, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching vocabulary_words by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Vocabulary_words]:
        """Get list of vocabulary_wordss filtered by field"""
        try:
            if not hasattr(Vocabulary_words, field_name):
                raise ValueError(f"Field {field_name} does not exist on Vocabulary_words")
            result = await self.db.execute(
                select(Vocabulary_words)
                .where(getattr(Vocabulary_words, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Vocabulary_words.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching vocabulary_wordss by {field_name}: {str(e)}")
            raise