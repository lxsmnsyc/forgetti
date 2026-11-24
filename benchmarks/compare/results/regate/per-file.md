| file                           | next R | RC adj. R     | plain R | f0.8 R        | next P | plain P | f0.8 P        | gzip next | gzip RC | ratio | compiled next | compiled RC | work rules   |
| ------------------------------ | ------ | ------------- | ------- | ------------- | ------ | ------- | ------------- | --------- | ------- | ----- | ------------- | ----------- | ------------ |
| base/bailout                   | 2      | 2 (raw 2)     | 2       | 1 (1 wrong)   | 2      | 2       | 1 (1 wrong)   | 197       | 197     | 1.000 | 0/1           | 0/1         | pass         |
| base/callback                  | 1      | 1 (raw 1)     | 3       | 1             | 1      | 3       | 1             | 337       | 496     | 0.679 | 1/1           | 1/1         | pass         |
| base/deepprop                  | 1      | 1 (raw 1)     | 4       | 2             | 1      | 4       | 2             | 269       | 412     | 0.653 | 1/1           | 1/1         | pass         |
| base/derived                   | 2      | 4 (raw 4)     | 6       | 2             | 2      | 6       | 2             | 324       | 450     | 0.720 | 1/1           | 1/1         | pass         |
| base/earlyreturn               | 1      | 1 (raw 1)     | 7       | 2             | 1      | 7       | 2             | 414       | 579     | 0.715 | 1/1           | 1/1         | pass         |
| base/forloop                   | 11     | 11 (raw 11)   | 17      | 0 (3 wrong)   | 11     | 17      | 0 (3 wrong)   | 338       | 453     | 0.746 | 1/1           | 1/1         | pass         |
| base/hook                      | 6      | 6 (raw 6)     | 6       | 2             | 6      | 6       | 2             | 295       | 434     | 0.680 | 2/2           | 1/1         | pass         |
| base/jsxprops                  | 1      | 1 (raw 1)     | 6       | 4             | 1      | 6       | 4             | 315       | 457     | 0.689 | 1/1           | 1/1         | pass         |
| base/map                       | 2      | 7 (raw 7)     | 13      | 2             | 2      | 13      | 2             | 347       | 442     | 0.785 | 1/1           | 1/1         | pass         |
| base/mutate                    | 2      | 2 (raw 2)     | 6       | 1             | 2      | 6       | 1             | 314       | 496     | 0.633 | 1/1           | 1/1         | pass         |
| base/statememo                 | 1      | 1 (raw 1)     | 1       | 1             | 1      | 1       | 1             | 359       | 581     | 0.618 | 1/1           | 1/1         | pass         |
| base/switch                    | 2      | 2 (raw 2)     | 4       | 2             | 2      | 4       | 2             | 397       | 504     | 0.788 | 1/1           | 1/1         | pass         |
| base/ternary                   | 1      | 2 (raw 2)     | 3       | 1             | 1      | 3       | 1             | 282       | 393     | 0.718 | 1/1           | 1/1         | pass         |
| base/trycatch                  | 2      | 2 (raw 2)     | 4       | 2             | 2      | 4       | 2             | 330       | 482     | 0.685 | 1/1           | 1/1         | pass         |
| base/usectx                    | 0      | 0 (raw 0)     | 0       | 0 (1 wrong)   | 0      | 0       | 0 (1 wrong)   | 293       | 428     | 0.685 | 1/1           | 1/1         | pass         |
| tuning/alias_branch            | 4      | 4 (raw 4)     | 4       | 0 (2 wrong)   | 4      | 4       | 0 (2 wrong)   | 271       | 442     | 0.613 | 1/1           | 1/1         | pass         |
| tuning/alias_child             | 3      | 3 (raw 3)     | 8       | 4             | 3      | 8       | 4             | 323       | 489     | 0.661 | 1/1           | 1/1         | pass         |
| tuning/alias_closure           | 4      | 4 (raw 4)     | 4       | 0 (1 wrong)   | 4      | 4       | 0 (1 wrong)   | 193       | 471     | 0.410 | 1/1           | 1/1         | pass         |
| tuning/alias_field             | 4      | 4 (raw 4)     | 4       | 0 (1 wrong)   | 4      | 4       | 0 (1 wrong)   | 287       | 491     | 0.585 | 1/1           | 1/1         | pass         |
| tuning/alias_push              | 4      | 4 (raw 4)     | 4       | 0 (1 wrong)   | 4      | 4       | 0 (1 wrong)   | 274       | 444     | 0.617 | 1/1           | 1/1         | pass         |
| tuning/alias_spread            | 3      | 3 (raw 3)     | 3       | 0 (1 wrong)   | 3      | 3       | 0 (1 wrong)   | 274       | 457     | 0.600 | 1/1           | 1/1         | pass         |
| tuning/alias_unknown           | 4      | 4 (raw 4)     | 4       | 0 (2 wrong)   | 4      | 4       | 0 (2 wrong)   | 276       | 467     | 0.591 | 1/1           | 1/1         | pass         |
| tuning/callback_globals        | 8      | 3 (raw 1)     | 8       | 1 (9 wrong)   | 8      | 8       | 1 (9 wrong)   | 569       | 858     | 0.663 | 6/6           | 6/6         | **above RC** |
| tuning/control_assign          | 4      | 4 (raw 4)     | 4       | 4             | 4      | 4       | 4             | 411       | 611     | 0.673 | 4/4           | 4/4         | pass         |
| tuning/discard_strict          | 3      | 3 (raw 3)     | 10      | 3             | -      | -       | -             | 432       | 702     | 0.615 | 2/2           | 2/2         | pass         |
| tuning/discard_suspense_mount  | 6      | 6 (raw 6)     | 7       | 6             | 4      | 5       | 4             | 421       | 583     | 0.722 | 2/2           | 2/2         | pass         |
| tuning/discard_suspense_update | 4      | 9 (raw 9)     | 13      | 4 (5 wrong)   | -      | -       | -             | 423       | 584     | 0.724 | 2/2           | 2/2         | pass         |
| tuning/discard_transition      | 4      | 4 (raw 4)     | 21      | 10            | 4      | 15      | 8             | 403       | 693     | 0.582 | 1/1           | 1/1         | pass         |
| tuning/escaping_closure        | 11     | 11 (raw 11)   | 21      | 13            | 11     | 21      | 13            | 1054      | 1470    | 0.717 | 3/3           | 3/3         | pass         |
| tuning/hook_effect_event       | 2      | 2 (raw 2)     | 2       | 2             | -      | -       | -             | 305       | 541     | 0.564 | 1/1           | 1/1         | pass         |
| tuning/hook_nested             | 11     | 11 (raw 11)   | 15      | 4             | 11     | 15      | 4             | 404       | 613     | 0.659 | 3/3           | 2/2         | pass         |
| tuning/hook_object             | 5      | 5 (raw 5)     | 5       | 0             | 5      | 5       | 0             | 393       | 692     | 0.568 | 2/2           | 2/2         | pass         |
| tuning/hook_use_cond           | 1      | 6 (raw 6)     | 6       | 1 (1 wrong)   | 1      | 6       | 1 (1 wrong)   | 333       | 460     | 0.724 | 1/1           | 1/1         | pass         |
| tuning/loop_shapes             | 23     | 52 (raw 52)   | 75      | 11 (12 wrong) | 24     | 75      | 12 (12 wrong) | 941       | 1031    | 0.913 | 10/10         | 8/11        | pass         |
| tuning/stable_children         | 16     | 23 (raw 23)   | 35      | 10            | 16     | 35      | 10            | 1036      | 1296    | 0.799 | 5/5           | 5/5         | pass         |
| tuning/throw_boundary_swap     | 3      | 3 (raw 3)     | 4       | 2 (2 wrong)   | 3      | 4       | 1 (3 wrong)   | 619       | 844     | 0.733 | 2/2           | 2/2         | pass         |
| tuning/throw_call              | 3      | 3 (raw 3)     | 6       | 2 (3 wrong)   | 2      | 5       | 1 (5 wrong)   | 522       | 692     | 0.754 | 2/2           | 2/2         | pass         |
| tuning/throw_group             | 6      | 13 (raw 13)   | 13      | 5 (2 wrong)   | 4      | 11      | 3 (5 wrong)   | 618       | 729     | 0.848 | 2/2           | 2/2         | pass         |
| tuning/throw_row               | 16     | 28 (raw 28)   | 40      | 22 (2 wrong)  | 10     | 34      | 16 (4 wrong)  | 583       | 746     | 0.782 | 2/2           | 2/2         | pass         |
| heldout/cart_summary           | 19     | 24 (raw 24)   | 65      | 22            | 19     | 65      | 22            | 2006      | 2377    | 0.844 | 5/5           | 5/5         | pass         |
| heldout/dashboard_card         | 12     | 12 (raw 12)   | 54      | 23 (2 wrong)  | 12     | 54      | 23 (2 wrong)  | 1900      | 2634    | 0.721 | 4/4           | 2/5         | pass         |
| heldout/form_validation        | 25     | 25 (raw 25)   | 72      | 29            | 25     | 72      | 29            | 2500      | 2995    | 0.835 | 2/2           | 2/2         | pass         |
| heldout/hex_input              | 0      | 0 (raw 0)     | 0       | 0             | 0      | 0       | 0             | 1356      | 1545    | 0.878 | 3/3           | 1/4         | pass         |
| heldout/hue_slider             | 0      | 0 (raw 0)     | 0       | 0             | 0      | 0       | 0             | 2390      | 2582    | 0.926 | 4/4           | 1/5         | pass         |
| heldout/list_filters           | 13     | 13 (raw 13)   | 13      | 8             | 13     | 13      | 8             | 2571      | 3035    | 0.847 | 3/3           | 3/3         | pass         |
| heldout/modal_effects          | 10     | 10 (raw 10)   | 34      | 20            | 10     | 34      | 20            | 1881      | 2423    | 0.776 | 4/4           | 2/4         | pass         |
| heldout/otp_input              | 0      | 0 (raw 0)     | 0       | 0 (33 wrong)  | 0      | 0       | 0 (33 wrong)  | 2447      | 2398    | 1.020 | 1/2           | 0/6         | pass         |
| heldout/table_sort             | 68     | 158 (raw 158) | 212     | 44            | 68     | 212     | 44            | 2183      | 2625    | 0.832 | 2/2           | 2/2         | pass         |
| heldout/tree_view              | 40     | 40 (raw 40)   | 58      | 25            | 40     | 55      | 25            | 1806      | 1634    | 1.105 | 2/2           | 1/2         | pass         |
| heldout2/accordion             | 4      | 4 (raw 4)     | 4       | 4             | 4      | 4       | 4             | 2534      | 2553    | 0.993 | 9/10          | 5/10        | pass         |
| heldout2/discussions_table     | 64     | 22 (raw 22)   | 64      | 1             | 64     | 64      | 1             | 2564      | 3501    | 0.732 | 18/18         | 17/18       | **above RC** |
| heldout2/form_check            | 41     | 38 (raw 38)   | 41      | 5             | 41     | 41      | 5             | 2205      | 2548    | 0.865 | 6/6           | 3/19        | **above RC** |
| heldout2/list_group            | 5      | 5 (raw 5)     | 5       | 2             | 5      | 5       | 2             | 2638      | 3338    | 0.790 | 8/9           | 7/9         | pass         |
| heldout2/pagination            | 13     | 13 (raw 13)   | 13      | 7             | 13     | 13      | 7             | 2427      | 3613    | 0.672 | 8/8           | 7/11        | pass         |
| heldout2/pricing_plans         | 31     | 38 (raw 38)   | 48      | 16            | 28     | 39      | 16            | 3044      | 2969    | 1.025 | 3/3           | 2/7         | pass         |
| heldout2/toast_stack           | 27     | 21 (raw 21)   | 27      | 7             | 27     | 27      | 7             | 2231      | 2613    | 0.854 | 9/10          | 5/13        | **above RC** |
| heldout2/toaster_store         | 74     | 45 (raw 45)   | 74      | 19            | 74     | 74      | 19            | 3016      | 3354    | 0.899 | 6/6           | 3/7         | **above RC** |
