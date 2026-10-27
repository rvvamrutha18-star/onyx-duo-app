// ONYX DUO aviation registry - Anchor program (paste into Solana Playground src/lib.rs)
// Replaces the hello_anchor starter. Keep declare_id! equal to your program's ID.
use anchor_lang::prelude::*;

declare_id!("FMZsoKzQoF7JtZmFd9pzBKkB8xY1aRi11689rXc8bFbQ");

// status codes: 0 Registered, 1 InService, 2 UnderMaintenance, 3 Quarantined, 4 Retired
// inspection result codes: 0 Pass, 1 Fail, 2 ActionRequired
const STATUS_RETIRED: u8 = 4;
const MAX_STATUS: u8 = 4;
const MAX_RESULT: u8 = 2;

#[program]
pub mod onyx_registry {
    use super::*;

    pub fn register_component(
        ctx: Context<RegisterComponent>,
        component_id: String,
        manufacturer: String,
        part_number: String,
        serial_number: String,
        aircraft_model: String,
    ) -> Result<()> {
        require!(!component_id.is_empty() && component_id.len() <= 32, OnyxError::BadLength);
        require!(!manufacturer.is_empty() && manufacturer.len() <= 48, OnyxError::BadLength);
        require!(!part_number.is_empty() && part_number.len() <= 32, OnyxError::BadLength);
        require!(!serial_number.is_empty() && serial_number.len() <= 48, OnyxError::BadLength);
        require!(!aircraft_model.is_empty() && aircraft_model.len() <= 48, OnyxError::BadLength);

        let now = Clock::get()?.unix_timestamp;
        let c = &mut ctx.accounts.component;
        c.authority = ctx.accounts.authority.key();
        c.component_id = component_id;
        c.manufacturer = manufacturer;
        c.part_number = part_number;
        c.serial_number = serial_number;
        c.aircraft_model = aircraft_model;
        c.status = 0;
        c.maintenance_count = 0;
        c.created_at = now;
        c.updated_at = now;
        c.bump = ctx.bumps.component;
        Ok(())
    }

    pub fn record_maintenance(
        ctx: Context<RecordMaintenance>,
        _component_id: String,
        inspection_result: u8,
        notes: String,
    ) -> Result<()> {
        require!(inspection_result <= MAX_RESULT, OnyxError::InvalidResult);
        require!(!notes.is_empty() && notes.len() <= 200, OnyxError::BadLength);
        require!(ctx.accounts.component.status != STATUS_RETIRED, OnyxError::Retired);

        let now = Clock::get()?.unix_timestamp;
        let component = &mut ctx.accounts.component;
        let r = &mut ctx.accounts.record;
        r.component = component.key();
        r.index = component.maintenance_count;
        r.technician = ctx.accounts.technician.key();
        r.inspection_result = inspection_result;
        r.notes = notes;
        r.timestamp = now;
        r.bump = ctx.bumps.record;

        component.maintenance_count = component
            .maintenance_count
            .checked_add(1)
            .ok_or(OnyxError::Overflow)?;
        component.updated_at = now;
        Ok(())
    }

    pub fn update_status(
        ctx: Context<UpdateStatus>,
        _component_id: String,
        new_status: u8,
    ) -> Result<()> {
        require!(new_status <= MAX_STATUS, OnyxError::InvalidStatus);
        let c = &mut ctx.accounts.component;
        require!(c.status != STATUS_RETIRED, OnyxError::Retired);
        c.status = new_status;
        c.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(component_id: String)]
pub struct RegisterComponent<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Component::INIT_SPACE,
        seeds = [b"component", component_id.as_bytes()],
        bump
    )]
    pub component: Account<'info, Component>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(component_id: String)]
pub struct RecordMaintenance<'info> {
    #[account(
        mut,
        seeds = [b"component", component_id.as_bytes()],
        bump = component.bump
    )]
    pub component: Account<'info, Component>,
    #[account(
        init,
        payer = technician,
        space = 8 + MaintenanceRecord::INIT_SPACE,
        seeds = [b"maintenance", component.key().as_ref(), &component.maintenance_count.to_le_bytes()],
        bump
    )]
    pub record: Account<'info, MaintenanceRecord>,
    #[account(mut)]
    pub technician: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(component_id: String)]
pub struct UpdateStatus<'info> {
    #[account(
        mut,
        seeds = [b"component", component_id.as_bytes()],
        bump = component.bump,
        has_one = authority @ OnyxError::Unauthorized
    )]
    pub component: Account<'info, Component>,
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Component {
    pub authority: Pubkey,
    #[max_len(32)]
    pub component_id: String,
    #[max_len(48)]
    pub manufacturer: String,
    #[max_len(32)]
    pub part_number: String,
    #[max_len(48)]
    pub serial_number: String,
    #[max_len(48)]
    pub aircraft_model: String,
    pub status: u8,
    pub maintenance_count: u32,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MaintenanceRecord {
    pub component: Pubkey,
    pub index: u32,
    pub technician: Pubkey,
    pub inspection_result: u8,
    #[max_len(200)]
    pub notes: String,
    pub timestamp: i64,
    pub bump: u8,
}

#[error_code]
pub enum OnyxError {
    #[msg("A text field is empty or too long")]
    BadLength,
    #[msg("Invalid status code")]
    InvalidStatus,
    #[msg("Invalid inspection result code")]
    InvalidResult,
    #[msg("Component is retired and can no longer change")]
    Retired,
    #[msg("Only the component authority can do this")]
    Unauthorized,
    #[msg("Counter overflow")]
    Overflow,
}
