-- Migration : qcm_images_admin_write
-- Appliquée sur crpduennbqaemhfaywrz le 2026-07-01 via MCP apply_migration.
-- Objectif : autoriser le staff (formateur/admin) à uploader/modifier/supprimer les images
-- de questions dans le bucket public `qcm-images` (jusqu'ici seule la lecture publique existait,
-- donc l'éditeur de QCM ne pouvait pas importer d'image).

create policy qcm_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'qcm-images' and is_admin());

create policy qcm_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'qcm-images' and is_admin())
  with check (bucket_id = 'qcm-images' and is_admin());

create policy qcm_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'qcm-images' and is_admin());
