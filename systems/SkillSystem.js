import { System } from '../core/Systems.js';

export class SkillSystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['SkillIntent'];
        this.cooldowns = {}; // Track cooldowns for skills
    }

    update(deltaTime) {
        const entities = this.entityManager.getEntitiesWith(this.requiredComponents);
        for (const entity of entities) {
            const skillIntent = entity.getComponent('SkillIntent');
            if (skillIntent) {
                console.log(`SkillSystem: Processing SkillIntent for entity ${entity.id}`, skillIntent);
                for (const intent of skillIntent.intents) {
                    const { skillId, slot, params } = intent;

                    // Check if the skill can be executed
                    if (this.canExecuteSkill(entity, skillId)) {
                        this.executeSkill(entity, skillId, params);
                    }
                }     
                // Clear the SkillIntentComponent after processing
                entity.removeComponent('SkillIntent');
                console.log(`SkillSystem: Finished processing SkillIntent ${skillIntent} for entity ${entity.id}`);
            } 

        }
    }

    canExecuteSkill(entity, skillId) {
        const now = Date.now();
        const cooldownEnd = this.cooldowns[skillId] || 0;
        return now >= cooldownEnd; // Skill can be executed if cooldown has expired
    }

    executeSkill(entity, skillId, params) {
        // Execute the skill logic (e.g., apply effects, animations, etc.)
        console.log(`Executing skill ${skillId} with params:`, params);

        switch (skillId) {
            case 'fireball':
                this.eventBus.emit('CastFireball', {
                    entityId: entity.id, ...params
                });
                break;

            case 'BasicRanged':
                let attackDirection = params.direction;

                if (!attackDirection || attackDirection === null) {
                    const player = this.entityManager.getEntity('player');
                    const actionTargetComp = player.getComponent('MouseActionTarget');
                    const position = player.getComponent('Position');
                    if (actionTargetComp) {
                        const actionTarget = { x: actionTargetComp.targetX, y: actionTargetComp.targetY };
                        attackDirection = actionTargetComp.direction;
                        if (!attackDirection || attackDirection===null) {
                            //attackDirection = this.utilities.calculateDirection(position, actionTarget);
                        }
                        //target = actionTargetComp.entityId;
                    }

                }
                if (!attackDirection || attackDirection===null) {
                    console.warn(`SkillSystem: BasicRanged skill requires a valid attackDirection parameter. ${attackDirection}`);
                    return;
                }
                this.eventBus.emit('RangedAttack', attackDirection);
            break;

        }
        // Set cooldown for the skill
        this.resetSkillCooldown(skillId);
       
    }

    resetSkillCooldown(skillId) {
        const skillData = this.getSkillData(skillId);
        if (skillData.cooldown) {
            this.cooldowns[skillId] = Date.now() + skillData.cooldown;
        }
    }

    getSkillData(skillId) {
        // Placeholder for fetching skill data
        return {
            cooldown:  100, // 5 seconds cooldown
        };
    }

}