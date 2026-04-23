import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.grammar_rules import Grammar_rulesService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/grammar_rules", tags=["grammar_rules"])


# ---------- Pydantic Schemas ----------
class Grammar_rulesData(BaseModel):
    """Entity data schema (for create/update)"""
    rule_name: str
    explanation_ru: str = None
    explanation_kz: str = None
    examples: str = None
    category: str = None


class Grammar_rulesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    rule_name: Optional[str] = None
    explanation_ru: Optional[str] = None
    explanation_kz: Optional[str] = None
    examples: Optional[str] = None
    category: Optional[str] = None


class Grammar_rulesResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    rule_name: str
    explanation_ru: Optional[str] = None
    explanation_kz: Optional[str] = None
    examples: Optional[str] = None
    category: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Grammar_rulesListResponse(BaseModel):
    """List response schema"""
    items: List[Grammar_rulesResponse]
    total: int
    skip: int
    limit: int


class Grammar_rulesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Grammar_rulesData]


class Grammar_rulesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Grammar_rulesUpdateData


class Grammar_rulesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Grammar_rulesBatchUpdateItem]


class Grammar_rulesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Grammar_rulesListResponse)
async def query_grammar_ruless(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query grammar_ruless with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying grammar_ruless: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Grammar_rulesService(db)
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
        logger.debug(f"Found {result['total']} grammar_ruless")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying grammar_ruless: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Grammar_rulesListResponse)
async def query_grammar_ruless_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query grammar_ruless with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying grammar_ruless: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Grammar_rulesService(db)
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
        logger.debug(f"Found {result['total']} grammar_ruless")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying grammar_ruless: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Grammar_rulesResponse)
async def get_grammar_rules(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single grammar_rules by ID (user can only see their own records)"""
    logger.debug(f"Fetching grammar_rules with id: {id}, fields={fields}")
    
    service = Grammar_rulesService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Grammar_rules with id {id} not found")
            raise HTTPException(status_code=404, detail="Grammar_rules not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching grammar_rules {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Grammar_rulesResponse, status_code=201)
async def create_grammar_rules(
    data: Grammar_rulesData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new grammar_rules"""
    logger.debug(f"Creating new grammar_rules with data: {data}")
    
    service = Grammar_rulesService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create grammar_rules")
        
        logger.info(f"Grammar_rules created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating grammar_rules: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating grammar_rules: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Grammar_rulesResponse], status_code=201)
async def create_grammar_ruless_batch(
    request: Grammar_rulesBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple grammar_ruless in a single request"""
    logger.debug(f"Batch creating {len(request.items)} grammar_ruless")
    
    service = Grammar_rulesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} grammar_ruless successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Grammar_rulesResponse])
async def update_grammar_ruless_batch(
    request: Grammar_rulesBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple grammar_ruless in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} grammar_ruless")
    
    service = Grammar_rulesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} grammar_ruless successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Grammar_rulesResponse)
async def update_grammar_rules(
    id: int,
    data: Grammar_rulesUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing grammar_rules (requires ownership)"""
    logger.debug(f"Updating grammar_rules {id} with data: {data}")

    service = Grammar_rulesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Grammar_rules with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Grammar_rules not found")
        
        logger.info(f"Grammar_rules {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating grammar_rules {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating grammar_rules {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_grammar_ruless_batch(
    request: Grammar_rulesBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple grammar_ruless by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} grammar_ruless")
    
    service = Grammar_rulesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} grammar_ruless successfully")
        return {"message": f"Successfully deleted {deleted_count} grammar_ruless", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_grammar_rules(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single grammar_rules by ID (requires ownership)"""
    logger.debug(f"Deleting grammar_rules with id: {id}")
    
    service = Grammar_rulesService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Grammar_rules with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Grammar_rules not found")
        
        logger.info(f"Grammar_rules {id} deleted successfully")
        return {"message": "Grammar_rules deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting grammar_rules {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")