import { System } from '../core/Systems.js';
import { InteractionIntentComponent } from '../core/Components.js';

export class PortalSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
    }

    update(deltaTime) {
        const players = this.entityManager.getEntitiesWith(['PlayerState', 'PortalInteraction']);
       
        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        //console.warn(`PortalSystem: Found ${players.length} dialogue component.`, dialogue);
      

         for (const player of players) {
            //console.warn(`PortalSystem: Processing player ${player.id} interaction with portal.`);
            const interactionComp = player.getComponent('PortalInteraction');
             const portal = this.entityManager.getEntity(interactionComp.portalId);

             if (dialogue.isOpen && !interactionComp.action) {
                 //console.warn('PortalSystem: Dialogue is active, skipping portal processing.');  
                 return; // Skip processing if dialogue is active
             }

            if (!portal) {
                console.warn('PortalSystem: Invalid portal entity.');
                player.removeComponent('PortalInteraction');
                return;
            }

            const portalComp = portal.getComponent('Portal');
            const portalBindComp = player.getComponent('PortalBinding');
            console.warn(`PortalSystem: Processing portal interaction`, portalComp, portalBindComp, interactionComp);

            if (!interactionComp.action) {
                // Present dialogue options only for uncleansed portals
                if (!portalComp.cleansed) {
                    this.presentDialogueOptions(player, portal, portalBindComp, interactionComp.tier, interactionComp);
                } else {
                    // Handle cleansed portal logic
                    this.handleCleansedPortal(player, portalComp, portalBindComp, interactionComp.tier);
                }
            } else {
                this.processPlayerAction(player, portal, portalComp, portalBindComp, interactionComp.tier, interactionComp);
            }
        }
    }

    presentDialogueOptions(player, portal, portalBindComp, tier, interactionComp) {
        const options = [
            {
                label: 'Cleanse',
                action: 'updatePortalInteraction',
                params: { action: 'cleansePortal', portalId:portal.id, tier }
            },
            {
                label: 'Enter Anyway',
                action: 'updatePortalInteraction',
                params: { action: 'teleport', portalId: portal.id, tier:'?' }
            },
        ];

        interactionComp.options = options; // Store options in the component

        // Emit the DialogueMessage event for the DialogueUISystem to handle
        this.eventBus.emit('DialogueMessage', {
            message: {
                message: 'This portal is not cleansed. What would you like to do?',
                options
            }
        });
    }

    

    processPlayerAction(player, portal, portalComp, portalBindComp, tier, interactionComp) {
        const playerResources = player.getComponent('Resource');

        switch (interactionComp.action) {
            case 'cleansePortal':
                let cleanse = false;
                if (playerResources.craftResources?.ashenShard >= 10) {
                    playerResources.craftResources.ashenShard -= 10;
                    cleanse = true;
                } else if (playerResources.craftResources?.ashenCrystal >= 1) {
                    playerResources.craftResources.ashenCrystal -= 1;
                    cleanse = true;
                }

                if (cleanse) {
                    const visuals = portal.getComponent('Visuals');

                    portalComp.cleansed = true; // Update the portal's state

                    portalBindComp.cleansed.push(tier);

                    visuals.avatar = 'img/anim/Portal-Animation-Cleansed.png';
                    visuals.hudIcon = 'img/avatars/portal-cleansed.png';
                    this.eventBus.emit('LightSourceActivated', ({ type: 'portalGreen', entityId: portal.id }));
                    console.log(`EntityGenerationSystem: generatePortal - emitted light source activation request for portal at tier ${tier} with definition portalGreen`);


                    interactionComp.action = null; // Reset action to allow handling cleansed portal on the next frame
                    this.utilities.logMessage({ channel: 'system', message: `You have cleansed the portal on tier ${tier}.` });
                    this.handleCleansedPortal(player, portalComp, portalBindComp, interactionComp.tier);
                   
                } else {
                    this.eventBus.emit('DialogueMessage', {
                        message: {
                            message: `You need 10 Ashen Shards or 1 Ashen Crystal to cleanse the portal, but you have only ${playerResources.craftResources.ashenShard} Ashen Shards and ${playerResources.craftResources.ashenCrystal} Ashen Crystals.`,
                            options: []
                        }
                    });
                    interactionComp.action = null; // Reset action to allow re-selection
                }
                break;

            case 'teleport':
                const destinationTier = interactionComp.params.tier === '?' ? null : interactionComp.tier;
                player.removeComponent('PortalInteraction'); // Remove the component after teleporting
                //this.handleTeleport(player, portalComp, portalBindComp, tier);
                console.log(`PortalSystem: Player ${player.id} requested teleportation to tier ${destinationTier}.`);
                this.handleTeleport(destinationTier);
                break;

            default:
                console.warn('PortalSystem: Unknown player action:', interactionComp.action);
        }
    }

    handleCleansedPortal(player, portalComp, portalBindComp, tier) {
        if (!portalBindComp.bindings.includes(tier)) {
            portalBindComp.bindings.push(tier);
        }

        const bindings = Array.isArray(portalBindComp.bindings) ? [...portalBindComp.bindings] : [];
        bindings.sort((a, b) => a - b);

        const options = bindings.map(tier => ({
            label: tier ,
            action: 'selectPortalTier',
            params: { tier }
        }));

        options.unshift({
            label: '?',
            action: 'selectPortalTier',
            params: { tier: '?' }
        });

        let intent = player.getComponent('InteractionIntent') || new InteractionIntentComponent();
        intent.intents.push({ action: 'openPortalDialogue', params: {} });
        player.addComponent(intent);

        // Emit the DialogueMessage event for the DialogueUISystem to handle
        this.eventBus.emit('DialogueMessage', {
            message: {
                message: 'Select a destination tier:',
                options
            }
        });

    }

    handleTeleport(tier) {
        const levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
        // Set destinationTier to null for randomization or the selected tier
        if (isNaN(parseInt(tier, 10)) || tier === null || tier === undefined) { tier = null; }
        levelTransition.destinationTier = tier;
        levelTransition.pendingTransition = 'portal';
        console.log(`InteractionSystem: Set pendingTransition to 'portal' with destinationTier: ${levelTransition.destinationTier}`);
    }
}
