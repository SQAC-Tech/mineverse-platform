create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger teams_updated_at    before update on teams              for each row execute function update_updated_at_column();
create trigger members_updated_at  before update on members            for each row execute function update_updated_at_column();
create trigger payments_updated_at before update on payments           for each row execute function update_updated_at_column();
create trigger att_rec_updated_at  before update on attendance_records for each row execute function update_updated_at_column();

create or replace function sync_payment_verification()
returns trigger as $$
begin
    if new.status = 'verified' then
        update teams set is_payment_verified = true,  status = 'verified'        where id = new.team_id;
    elsif new.status in ('pending', 'rejected') then
        update teams set is_payment_verified = false, status = 'payment_pending' where id = new.team_id;
    end if;
    return new;
end;
$$ language plpgsql;

create trigger payment_verification_sync after update of status on payments
    for each row execute function sync_payment_verification();

create or replace function generate_team_code()
returns text as $$
declare
    new_code text;
    exists_check boolean;
begin
    loop
        new_code := 'MNV-' || lpad(floor(random() * 1000)::text, 3, '0');
        select exists(select 1 from teams where team_code = new_code) into exists_check;
        if not exists_check then
            return new_code;
        end if;
    end loop;
end;
$$ language plpgsql;
