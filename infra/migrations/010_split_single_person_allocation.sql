alter table split_expenses
  drop constraint if exists split_expenses_split_method;

alter table split_expenses
  add constraint split_expenses_split_method
  check (split_method in ('equal', 'exact', 'single', 'percentage', 'shares'));
