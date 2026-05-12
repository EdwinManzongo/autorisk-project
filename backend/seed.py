import logging
from database import db
from models.user import User
from models.enums import UserRole
from core.security import hash_password

logger = logging.getLogger(__name__)


async def seed_database():
    if not await db.users.find_one({"email": "admin@autorisk.com"}):
        admin = User(
            email="admin@autorisk.com",
            full_name="System Administrator",
            role=UserRole.ADMIN,
        )
        doc = admin.model_dump(mode="json")
        doc["hashed_password"] = hash_password("admin123")
        await db.users.insert_one(doc)
        logger.info("Seeded default admin: admin@autorisk.com / admin123")

    if not await db.users.find_one({"email": "underwriter@autorisk.com"}):
        uw = User(
            email="underwriter@autorisk.com",
            full_name="Jane Underwriter",
            role=UserRole.UNDERWRITER,
        )
        doc = uw.model_dump()
        doc["hashed_password"] = hash_password("pass123")
        await db.users.insert_one(doc)
        logger.info("Seeded underwriter user")

    if not await db.users.find_one({"email": "agent@autorisk.com"}):
        agent = User(
            email="agent@autorisk.com",
            full_name="John Agent",
            role=UserRole.AGENT,
        )
        doc = agent.model_dump()
        doc["hashed_password"] = hash_password("pass123")
        await db.users.insert_one(doc)
        logger.info("Seeded agent user")
