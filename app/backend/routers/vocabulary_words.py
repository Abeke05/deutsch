import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.vocabulary_words import Vocabulary_wordsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/vocabulary_words", tags=["vocabulary_words"])


# ---------- Pydantic Schemas ----------
class Vocabulary_wordsData(BaseModel):
    """Entity data schema (for create/update)"""
    german_word: str
    plural_form: str = None
    part_of_speech: str = None
    gender: str = None
    russian_translation: str = None
    kazakh_translation: str = None
    example_sentence: str = None
    category: str = None
    subcategories: str = None


class Vocabulary_wordsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    german_word: Optional[str] = None
    plural_form: Optional[str] = None
    part_of_speech: Optional[str] = None
    gender: Optional[str] = None
    russian_translation: Optional[str] = None
    kazakh_translation: Optional[str] = None
    example_sentence: Optional[str] = None
    category: Optional[str] = None
    subcategories: Optional[str] = None


class Vocabulary_wordsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    german_word: str
    plural_form: Optional[str] = None
    part_of_speech: Optional[str] = None
    gender: Optional[str] = None
    russian_translation: Optional[str] = None
    kazakh_translation: Optional[str] = None
    example_sentence: Optional[str] = None
    category: Optional[str] = None
    subcategories: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Vocabulary_wordsListResponse(BaseModel):
    """List response schema"""
    items: List[Vocabulary_wordsResponse]
    total: int
    skip: int
    limit: int


class Vocabulary_wordsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Vocabulary_wordsData]


class Vocabulary_wordsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Vocabulary_wordsUpdateData


class Vocabulary_wordsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Vocabulary_wordsBatchUpdateItem]


class Vocabulary_wordsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Vocabulary_wordsListResponse)
async def query_vocabulary_wordss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query vocabulary_wordss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying vocabulary_wordss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Vocabulary_wordsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} vocabulary_wordss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying vocabulary_wordss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Vocabulary_wordsListResponse)
async def query_vocabulary_wordss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query vocabulary_wordss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying vocabulary_wordss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Vocabulary_wordsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} vocabulary_wordss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying vocabulary_wordss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Vocabulary_wordsResponse)
async def get_vocabulary_words(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single vocabulary_words by ID (user can only see their own records)"""
    logger.debug(f"Fetching vocabulary_words with id: {id}, fields={fields}")
    
    service = Vocabulary_wordsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Vocabulary_words with id {id} not found")
            raise HTTPException(status_code=404, detail="Vocabulary_words not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching vocabulary_words {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Vocabulary_wordsResponse, status_code=201)
async def create_vocabulary_words(
    data: Vocabulary_wordsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new vocabulary_words"""
    logger.debug(f"Creating new vocabulary_words with data: {data}")
    
    service = Vocabulary_wordsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create vocabulary_words")
        
        logger.info(f"Vocabulary_words created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating vocabulary_words: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating vocabulary_words: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Vocabulary_wordsResponse], status_code=201)
async def create_vocabulary_wordss_batch(
    request: Vocabulary_wordsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple vocabulary_wordss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} vocabulary_wordss")
    
    service = Vocabulary_wordsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} vocabulary_wordss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Vocabulary_wordsResponse])
async def update_vocabulary_wordss_batch(
    request: Vocabulary_wordsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple vocabulary_wordss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} vocabulary_wordss")
    
    service = Vocabulary_wordsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} vocabulary_wordss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Vocabulary_wordsResponse)
async def update_vocabulary_words(
    id: int,
    data: Vocabulary_wordsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing vocabulary_words (requires ownership)"""
    logger.debug(f"Updating vocabulary_words {id} with data: {data}")

    service = Vocabulary_wordsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Vocabulary_words with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Vocabulary_words not found")
        
        logger.info(f"Vocabulary_words {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating vocabulary_words {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating vocabulary_words {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_vocabulary_wordss_batch(
    request: Vocabulary_wordsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple vocabulary_wordss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} vocabulary_wordss")
    
    service = Vocabulary_wordsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} vocabulary_wordss successfully")
        return {"message": f"Successfully deleted {deleted_count} vocabulary_wordss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_vocabulary_words(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single vocabulary_words by ID (requires ownership)"""
    logger.debug(f"Deleting vocabulary_words with id: {id}")
    
    service = Vocabulary_wordsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Vocabulary_words with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Vocabulary_words not found")
        
        logger.info(f"Vocabulary_words {id} deleted successfully")
        return {"message": "Vocabulary_words deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting vocabulary_words {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")