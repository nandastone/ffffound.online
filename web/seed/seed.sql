-- Synthetic seed data so `wrangler dev` shows realistic-looking pages
-- before we have real WARC extraction. Safe to re-run: clears + reinserts.

DELETE FROM image_related;
DELETE FROM saves;
DELETE FROM images;
DELETE FROM users;

INSERT INTO users (username, display_name, joined_at, bio, save_count) VALUES
  ('amelia',   'Amelia',     1199145600, 'designer · brooklyn',   42),
  ('boris',    'Boris K.',   1230768000, NULL,                    19),
  ('cyclops',  'cyclops',    1262304000, 'one eye open',          88),
  ('delphine', 'Delphine',   1293840000, 'colour fields',         13),
  ('eero',     'eero',       1325376000, 'finnish/typography',    27),
  ('fukuda',   'M. Fukuda',  1356998400, NULL,                    51),
  ('gretel',   'gretel',     1388534400, NULL,                     7),
  ('hayao',    'hayao',      1420070400, 'film stills mostly',    34),
  ('isolde',   'Isolde',     1451606400, NULL,                    22),
  ('juno',     'juno',       1483228800, 'archive curator',      105);

-- 24 images. r2_key is null for half on purpose to exercise the missing-bytes
-- UI branch. Titles mimic real ffffound page-name strings.
INSERT INTO images (image_id, uploader, title, source_url, source_dead, cdn_thumbnail_url, r2_key, width, height, uploaded_at, save_count) VALUES
  ('1001', 'amelia',  'SUICIDE BOMBERS FOR JESUS',                 'http://example.com/dead-1',  1, 'http://static.ffffound.com/m/1001.jpg', 'fake/1001.jpg', 800, 600,  1199145700, 14),
  ('1002', 'boris',   'Things Organized Neatly',                   'http://example.com/dead-2',  1, 'http://static.ffffound.com/m/1002.jpg', 'fake/1002.jpg', 800, 1200, 1199232000,  6),
  ('1003', 'cyclops', 'this isn''t happiness',                     'http://example.com/dead-3',  1, 'http://static.ffffound.com/m/1003.jpg', 'fake/1003.jpg', 1200, 800, 1199318400, 22),
  ('1004', 'delphine','but does it float',                         'http://example.com/dead-4',  1, 'http://static.ffffound.com/m/1004.jpg', 'fake/1004.jpg', 1000, 1000, 1199404800, 3),
  ('1005', 'eero',    'DETHJUNKIE*',                               'http://example.com/dead-5',  1, 'http://static.ffffound.com/m/1005.jpg', 'fake/1005.jpg', 600, 900,  1199491200, 11),
  ('1006', 'fukuda',  'Have a Nice Day',                           'http://example.com/dead-6',  1, 'http://static.ffffound.com/m/1006.jpg', 'fake/1006.jpg', 900, 600,  1199577600, 18),
  ('1007', 'gretel',  'YIMMY''S YAYO',                             'http://example.com/dead-7',  1, 'http://static.ffffound.com/m/1007.jpg', 'fake/1007.jpg', 1200, 1200, 1199664000, 2),
  ('1008', 'hayao',   'Nickel Cobalt',                             'http://example.com/dead-8',  1, 'http://static.ffffound.com/m/1008.jpg', 'fake/1008.jpg', 1600, 900,  1199750400, 31),
  ('1009', 'isolde',  'OTAKU GANGSTA',                             'http://example.com/dead-9',  1, 'http://static.ffffound.com/m/1009.jpg', 'fake/1009.jpg', 800, 800,  1199836800, 5),
  ('1010', 'juno',    'VISUAL OBSERVER',                           'http://example.com/dead-10', 1, 'http://static.ffffound.com/m/1010.jpg', 'fake/1010.jpg', 1200, 1600, 1199923200, 44),
  ('1011', 'amelia',  'Every reform movement has a lunatic fringe','http://example.com/dead-11', 1, 'http://static.ffffound.com/m/1011.jpg', 'fake/1011.jpg', 800, 600,  1200009600, 4),
  ('1012', 'cyclops', 'on Flickr - Photo Sharing!',                'http://example.com/dead-12', 1, 'http://static.ffffound.com/m/1012.jpg', 'fake/1012.jpg', 800, 1200, 1200096000, 9),
  ('1013', 'fukuda',  NULL,                                        'http://example.com/dead-13', 1, 'http://static.ffffound.com/m/1013.jpg', NULL,            1200, 800, 1200182400, 1),
  ('1014', 'hayao',   'Tumblr',                                    'http://example.com/dead-14', 1, 'http://static.ffffound.com/m/1014.jpg', NULL,            1000, 1000, 1200268800, 12),
  ('1015', 'juno',    'Things Organized Neatly',                   'http://example.com/dead-15', 1, 'http://static.ffffound.com/m/1015.jpg', NULL,            600, 900,  1200355200, 6),
  ('1016', 'delphine','but does it float',                         'http://example.com/dead-16', 1, 'http://static.ffffound.com/m/1016.jpg', NULL,            900, 600,  1200441600, 2),
  ('1017', 'boris',   NULL,                                        'http://example.com/dead-17', 1, 'http://static.ffffound.com/m/1017.jpg', NULL,            1200, 1200, 1200528000, 1),
  ('1018', 'eero',    'this isn''t happiness',                     'http://example.com/dead-18', 1, 'http://static.ffffound.com/m/1018.jpg', NULL,            1600, 900,  1200614400, 16),
  ('1019', 'gretel',  'DETHJUNKIE*',                               'http://example.com/dead-19', 1, 'http://static.ffffound.com/m/1019.jpg', NULL,            800, 800,  1200700800, 3),
  ('1020', 'isolde',  'Have a Nice Day',                           'http://example.com/dead-20', 1, 'http://static.ffffound.com/m/1020.jpg', NULL,            1200, 1600, 1200787200, 8),
  ('1021', 'juno',    NULL,                                        'http://example.com/dead-21', 1, 'http://static.ffffound.com/m/1021.jpg', NULL,            800, 600,  1200873600, 3),
  ('1022', 'amelia',  'YIMMY''S YAYO',                             'http://example.com/dead-22', 1, 'http://static.ffffound.com/m/1022.jpg', NULL,            800, 1200, 1200960000, 5),
  ('1023', 'fukuda',  'Nickel Cobalt',                             'http://example.com/dead-23', 1, 'http://static.ffffound.com/m/1023.jpg', NULL,            1200, 800, 1201046400, 24),
  ('1024', 'hayao',   'OTAKU GANGSTA',                             'http://example.com/dead-24', 1, 'http://static.ffffound.com/m/1024.jpg', NULL,            1000, 1000, 1201132800, 2);

-- Saves — each image saved by 0–4 users.
INSERT INTO saves (image_id, username, saved_at) VALUES
  ('1001','boris',1199146000),('1001','cyclops',1199146100),('1001','juno',1199146200),
  ('1002','amelia',1199232100),
  ('1003','juno',1199318500),('1003','hayao',1199318600),('1003','delphine',1199318700),('1003','amelia',1199318800),
  ('1005','fukuda',1199491300),('1005','juno',1199491400),
  ('1006','isolde',1199577700),('1006','juno',1199577800),('1006','amelia',1199577900),
  ('1008','juno',1199750500),('1008','cyclops',1199750600),('1008','eero',1199750700),
  ('1010','amelia',1199923300),('1010','boris',1199923400),('1010','cyclops',1199923500),('1010','delphine',1199923600),
  ('1012','juno',1200096100),
  ('1014','juno',1200268900),('1014','isolde',1200269000),
  ('1018','juno',1200614500),('1018','hayao',1200614600),
  ('1020','amelia',1200787300),
  ('1023','juno',1201046500),('1023','cyclops',1201046600),('1023','eero',1201046700);

-- "you may like these" edges. Image 1003 has a busy related list to exercise
-- the rendering; others get a couple each.
INSERT INTO image_related (image_id, related_id, position) VALUES
  ('1003','1018',0),('1003','1005',1),('1003','1019',2),('1003','1008',3),
  ('1003','1024',4),('1003','1023',5),('1003','1010',6),('1003','1014',7),
  ('1010','1003',0),('1010','1018',1),('1010','1023',2),
  ('1008','1010',0),('1008','1023',1),
  ('1023','1008',0),('1023','1010',1),('1023','1003',2);
