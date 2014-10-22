suite('rb/views/ReviewRequestEditorView', function() {
    var reviewRequest,
        editor,
        view,
        template = _.template([
            '<div>',
            ' <div id="review_request_banners"></div>',
            ' <div id="review-request-warning"></div>',
            ' <div class="actions">',
            '  <a href="#" id="discard-review-request-link"></a>',
            '  <a href="#" id="link-review-request-close-submitted"></a>',
            '  <a href="#" id="delete-review-request-link"></a>',
            ' </div>',
            ' <div class="review-request">',
            '  <div id="review_request_main">',
            '   <span id="field_summary"',
            '         data-field-id="summary"',
            '         class="field editable"></span>',
            '   <span id="field_branch"',
            '         data-field-id="branch"',
            '         class="field editable"></span>',
            '   <span id="field_bugs_closed"',
            '         data-field-id="bugs_closed"',
            '         class="field editable comma-editable"></span>',
            '   <span id="field_target_groups"',
            '         data-field-id="target_groups"',
            '         class="field editable comma-editable"></span>',
            '   <span id="field_target_people"',
            '         data-field-id="target_people"',
            '         class="field editable"></span>',
            '   <div class="content">',
            '    <pre id="field_description"',
            '         data-field-id="description"',
            '         class="field field-text-area editable"></pre>',
            '   </div>',
            '   <div class="content">',
            '    <pre id="field_testing_done"',
            '         data-field-id="testing_done"',
            '         class="field field-text-area editable"></pre>',
            '   </div>',
            '   <div class="content">',
            '    <pre id="field_my_custom"',
            '         data-field-id="my_custom"',
            '         class="field editable"></pre>',
            '   </div>',
            '  </div>',
            ' </div>',
            ' <div id="review_request_extra">',
            '  <div>',
            '   <div id="file-list"><br /></div>',
            '  </div>',
            '  <div>',
            '   <div id="screenshot-thumbnails"><br /></div>',
            '  </div>',
            ' </div>',
            '</div>'
        ].join('')),
        screenshotThumbnailTemplate = _.template([
            '<div class="screenshot-container" data-screenshot-id="<%= id %>">',
            ' <div class="screenshot-caption">',
            '  <a class="edit"></a>',
            ' </div>',
            ' <a class="delete">X</a>',
            '</div>'
        ].join('')),
        $warning,
        $filesContainer,
        $screenshotsContainer;

    beforeEach(function() {
        var $el = $(template()).appendTo($testsScratch);

        reviewRequest = new RB.ReviewRequest({
            id: 123,
            'public': true,
            state: RB.ReviewRequest.PENDING
        });

        editor = new RB.ReviewRequestEditor({
            mutableByUser: true,
            statusMutableByUser: true,
            reviewRequest: reviewRequest,
            commentIssueManager: new RB.CommentIssueManager()
        });

        view = new RB.ReviewRequestEditorView({
            el: $el,
            model: editor
        });

        $warning = $testsScratch.find('#review-request-warning');
        $filesContainer = $testsScratch.find('#file-list');
        $screenshotsContainer = $testsScratch.find('#screenshot-thumbnails');

        /*
         * XXX Prevent _refreshPage from being called. Eventually, that
         *     function will go away.
         */
        spyOn(view, '_refreshPage');

        spyOn(reviewRequest.draft, 'ready')
            .andCallFake(function(options, context) {
                options.ready.call(context);
            });
    });

    describe('Actions bar', function() {
        beforeEach(function() {
            view.render();
        });

        describe('Close', function() {
            it('Delete Permanently', function() {
                var $buttons = $();

                spyOn(reviewRequest, 'destroy');
                spyOn($.fn, 'modalBox').andCallFake(function(options) {
                    _.each(options.buttons, function($btn) {
                        $buttons = $buttons.add($btn);
                    });

                    /* Simulate the modalBox API for what we need. */
                    return {
                        modalBox: function(cmd) {
                            expect(cmd).toBe('buttons');

                            return $buttons;
                        }
                    };
                });

                $('#delete-review-request-link').click();
                expect($.fn.modalBox).toHaveBeenCalled();

                $buttons.filter('input[value="Delete"]').click();
                expect(reviewRequest.destroy).toHaveBeenCalled();
            });

            it('Discarded', function() {
                spyOn(reviewRequest, 'close').andCallFake(function(options) {
                    expect(options.type).toBe(RB.ReviewRequest.CLOSE_DISCARDED);
                });

                spyOn(window, 'confirm').andReturn(true);

                $('#discard-review-request-link').click();

                expect(reviewRequest.close).toHaveBeenCalled();
            });

            it('Submitted', function() {
                spyOn(reviewRequest, 'close').andCallFake(function(options) {
                    expect(options.type).toBe(RB.ReviewRequest.CLOSE_SUBMITTED);
                });

                $('#link-review-request-close-submitted').click();

                expect(reviewRequest.close).toHaveBeenCalled();
            });
        });
    });

    describe('Banners', function() {
        beforeEach(function() {
            view.render();
        });

        describe('Draft banner', function() {
            describe('Visibility', function() {
                it('Hidden when saving', function() {
                    expect(view.banner).toBe(null);
                    editor.trigger('saving');
                    expect(view.banner).toBe(null);
                });

                it('Show when saved', function() {
                    expect(view.banner).toBe(null);
                    editor.trigger('saved');
                    expect(view.banner).not.toBe(null);
                    expect(view.banner.$el.is(':visible')).toBe(true);
                });
            });

            describe('Buttons actions', function() {
                it('Discard Draft', function() {
                    view.showBanner();

                    spyOn(reviewRequest.draft, 'destroy');

                    $('#btn-draft-discard').click();

                    expect(reviewRequest.draft.destroy).toHaveBeenCalled();
                });

                it('Discard Review Request', function() {
                    reviewRequest.set('public', false);
                    view.showBanner();

                    spyOn(reviewRequest, 'close')
                        .andCallFake(function(options) {
                            expect(options.type).toBe(
                                RB.ReviewRequest.CLOSE_DISCARDED);
                        });

                    $('#btn-review-request-discard').click();

                    expect(reviewRequest.close).toHaveBeenCalled();
                });

                it('Publish', function() {
                    view.showBanner();

                    spyOn(editor, 'publishDraft').andCallThrough();
                    spyOn(reviewRequest.draft, 'ensureCreated')
                        .andCallFake(function(options, context) {
                            options.success.call(context);
                        });
                    spyOn(reviewRequest.draft, 'publish');

                    /* Set up some basic state so that we pass validation. */
                    reviewRequest.draft.set({
                        targetGroups: [{
                            name: 'foo',
                            url: '/groups/foo'
                        }],
                        summary: 'foo',
                        description: 'foo'
                    });

                    $('#btn-draft-publish').click();

                    expect(editor.get('publishing')).toBe(true);
                    expect(editor.get('pendingSaveCount')).toBe(0);
                    expect(editor.publishDraft).toHaveBeenCalled();
                    expect(reviewRequest.draft.publish).toHaveBeenCalled();
                });
            });

            describe('Button states', function() {
                var $buttons;

                beforeEach(function() {
                    view.showBanner();

                    $buttons = view.banner.$buttons;
                });

                it('Enabled by default', function() {
                    expect($buttons.prop('disabled')).toBe(false);
                });

                it('Disabled when saving', function() {
                    expect($buttons.prop('disabled')).toBe(false);
                    editor.trigger('saving');
                    expect($buttons.prop('disabled')).toBe(true);
                });

                it('Enabled when saved', function() {
                    expect($buttons.prop('disabled')).toBe(false);
                    editor.trigger('saving');
                    expect($buttons.prop('disabled')).toBe(true);
                    editor.trigger('saved');
                    expect($buttons.prop('disabled')).toBe(false);
                });
            });
        });

        describe('Discarded banner', function() {
            beforeEach(function() {
                reviewRequest.set('state', RB.ReviewRequest.CLOSE_DISCARDED);
            });

            it('Visibility', function() {
                expect(view.banner).toBe(null);

                view.showBanner();

                expect(view.banner).not.toBe(null);
                expect(view.banner.el.id).toBe('discard-banner');
                expect(view.banner.$el.is(':visible')).toBe(true);
            });

            describe('Buttons actions', function() {
                beforeEach(function() {
                    expect(view.banner).toBe(null);
                    view.showBanner();
                });

                it('Reopen', function() {
                    spyOn(reviewRequest, 'reopen');

                    $('#btn-review-request-reopen').click();

                    expect(reviewRequest.reopen).toHaveBeenCalled();
                });
            });
        });

        describe('Submitted banner', function() {
            beforeEach(function() {
                reviewRequest.set('state', RB.ReviewRequest.CLOSE_SUBMITTED);
            });

            it('Visibility', function() {
                expect(view.banner).toBe(null);

                view.showBanner();

                expect(view.banner).not.toBe(null);
                expect(view.banner.el.id).toBe('submitted-banner');
                expect(view.banner.$el.is(':visible')).toBe(true);
            });

            describe('Buttons actions', function() {
                beforeEach(function() {
                    expect(view.banner).toBe(null);
                    reviewRequest.set('state', RB.ReviewRequest.CLOSE_SUBMITTED);
                    view.showBanner();
                });

                it('Reopen', function() {
                    spyOn(reviewRequest, 'reopen');

                    $('#btn-review-request-reopen').click();

                    expect(reviewRequest.reopen).toHaveBeenCalled();
                });
            });
        });
    });

    describe('Fields', function() {
        var saveSpyFunc,
            jsonFieldName,
            jsonTextTypeFieldName,
            supportsRichText,
            useExtraData,
            $field,
            $input;

        beforeEach(function() {
            if (!saveSpyFunc) {
                saveSpyFunc = function(options, context) {
                    expect(options.data[jsonFieldName]).toBe('My Value');
                    options.success.call(context);
                };
            }

            spyOn(reviewRequest.draft, 'save').andCallFake(saveSpyFunc);

            view.render();
        });

        function setupFieldTests(options) {
            beforeEach(function() {
                jsonFieldName = options.jsonFieldName;
                jsonTextTypeFieldName = jsonFieldName + '_text_type';
                supportsRichText = !!options.supportsRichText;
                useExtraData = options.useExtraData;
                $field = view.$(options.selector);
                $input = $field.inlineEditor('field');
            });
        }

        function hasAutoCompleteTest() {
            it('Has auto-complete', function() {
                expect($input.data('rbautocomplete')).not.toBe(undefined);
            });
        }

        function hasEditorTest() {
            it('Has editor', function() {
                expect($field.data('inlineEditor')).not.toBe(undefined);
            });
        }

        function runSavingTest(richText, textType) {
            runs(function() {
                var textEditor;

                $field.inlineEditor('startEdit');

                if (supportsRichText) {
                    expect($field.hasClass('field-text-area')).toBe(true);

                    textEditor = $input.data('text-editor');
                    textEditor.setText('My Value');
                    textEditor.setRichText(richText);
                } else {
                    $input.val('My Value');
                }

                $input.triggerHandler('keyup');
                expect($field.inlineEditor('value')).toBe('My Value');
            });

            waitsFor(function() {
                return $field.inlineEditor('dirty');
            });

            runs(function() {
                var expectedData = {},
                    fieldPrefix = (useExtraData ? 'extra_data.' : '');

                expectedData[fieldPrefix + jsonFieldName] = 'My Value';

                if (supportsRichText) {
                    expectedData[fieldPrefix + jsonTextTypeFieldName] =
                        textType;

                    expectedData.force_text_type = 'html';
                    expectedData.include_raw_text_fields = true;
                }

                expect($field.inlineEditor('dirty')).toBe(true);
                $field.inlineEditor('submit');

                expect(reviewRequest.draft.save).toHaveBeenCalled();
                expect(reviewRequest.draft.save.calls[0].args[0].data)
                    .toEqual(expectedData);
            });
        }

        function savingTest() {
            it('Saves', function() {
                expect(supportsRichText).toBe(false);
                runSavingTest();
            });
        }

        function richTextSavingTest() {
            describe('Saves', function() {
                it('For Markdown', function() {
                    expect(supportsRichText).toBe(true);
                    runSavingTest(true, 'markdown');
                });

                it('For plain text', function() {
                    expect(supportsRichText).toBe(true);
                    runSavingTest(false, 'plain');
                });
            });
        }

        function editCountTests() {
            describe('Edit counts', function() {
                it('When opened', function() {
                    expect(editor.get('editCount')).toBe(0);
                    $field.inlineEditor('startEdit');
                    expect(editor.get('editCount')).toBe(1);
                });

                it('When canceled', function() {
                    $field.inlineEditor('startEdit');
                    $field.inlineEditor('cancel');
                    expect(editor.get('editCount')).toBe(0);
                });

                it('When submitted', function() {
                    $field.inlineEditor('startEdit');
                    $input
                        .val('My Value')
                        .triggerHandler('keyup');
                    $field.inlineEditor('submit');

                    expect(editor.get('editCount')).toBe(0);
                });
            });
        }

        describe('Branch', function() {
            setupFieldTests({
                jsonFieldName: 'branch',
                selector: '#field_branch'
            });

            hasEditorTest();
            savingTest();
            editCountTests();
        });

        describe('Bugs Closed', function() {
            setupFieldTests({
                jsonFieldName: 'bugs_closed',
                selector: '#field_bugs_closed'
            });

            hasEditorTest();
            savingTest();

            describe('Formatting', function() {
                it('With bugTrackerURL', function() {
                    reviewRequest.set('bugTrackerURL', 'http://issues/?id=%s');
                    reviewRequest.draft.set('bugsClosed', [1, 2, 3]);

                    expect($field.html()).toBe(
                        '<a href="http://issues/?id=1">1</a>, ' +
                        '<a href="http://issues/?id=2">2</a>, ' +
                        '<a href="http://issues/?id=3">3</a>');
                });

                it('Without bugTrackerURL', function() {
                    reviewRequest.set('bugTrackerURL', '');
                    reviewRequest.draft.set('bugsClosed', [1, 2, 3]);

                    expect($field.html()).toBe('1, 2, 3');
                });
            });

            editCountTests();
        });

        describe('Change Descriptions', function() {
            function closeDescriptionTests(options) {
                beforeEach(function() {
                    reviewRequest.set('state', options.closeType);
                    view.showBanner();

                    spyOn(reviewRequest, 'close').andCallThrough();
                    spyOn(reviewRequest, 'save');
                });

                setupFieldTests({
                    jsonFieldName: 'changedescription',
                    selector: options.bannerSel + ' #field_changedescription'
                });

                hasEditorTest();

                it('Starts closed', function() {
                    expect($input.is(':visible')).toBe(false);
                });

                describe('Saves', function() {
                    function testSave(richText, textType, setRichText) {
                        var textEditor,
                            expectedData = {
                                status: options.jsonCloseType,
                                force_text_type: 'html',
                                include_raw_text_fields: true
                            };

                        expectedData[options.jsonTextTypeFieldName] = textType;
                        expectedData[options.jsonFieldName] = 'My Value';

                        $field.inlineEditor('startEdit');

                        textEditor = $input.data('text-editor');
                        textEditor.setText('My Value');

                        if (setRichText !== false) {
                            textEditor.setRichText(richText);
                        }

                        $input.triggerHandler('keyup');
                        $field.inlineEditor('submit');

                        expect(reviewRequest.close).toHaveBeenCalled();
                        expect(reviewRequest.save).toHaveBeenCalled();
                        expect(reviewRequest.save.calls[0].args[0].data)
                            .toEqual(expectedData);
                    }

                    it('For Markdown', function() {
                        testSave(true, 'markdown');
                    });

                    it('For plain text', function() {
                        testSave(false, 'plain');
                    });
                });

                describe('State when statusEditable', function() {
                    it('Disabled when false', function() {
                        editor.set('statusEditable', false);
                        expect($field.inlineEditor('option', 'enabled')).toBe(false);
                    });

                    it('Enabled when true', function() {
                        editor.set('statusEditable', true);
                        expect($field.inlineEditor('option', 'enabled')).toBe(true);
                    });
                });

                describe('Formatting', function() {
                    it('Links', function() {
                        reviewRequest.set('closeDescription',
                                          'Testing /r/123');

                        expect($field.text()).toBe('Testing /r/123');
                        expect($field.find('a').attr('href')).toBe('/r/123/');
                    });
                });

                editCountTests();
            }

            describe('Discarded review requests', function() {
                closeDescriptionTests({
                    bannerSel: '#discard-banner',
                    closeType: RB.ReviewRequest.CLOSE_DISCARDED,
                    jsonCloseType: 'discarded',
                    jsonFieldName: 'close_description',
                    jsonTextTypeFieldName: 'close_description_text_type'
                });
            });

            describe('Draft review requests', function() {
                beforeEach(function() {
                    view.showBanner();
                });

                setupFieldTests({
                    supportsRichText: true,
                    jsonFieldName: 'changedescription',
                    selector: '#draft-banner #field_changedescription'
                });

                hasEditorTest();
                richTextSavingTest();

                editCountTests();
            });

            describe('Submitted review requests', function() {
                closeDescriptionTests({
                    bannerSel: '#submitted-banner',
                    closeType: RB.ReviewRequest.CLOSE_SUBMITTED,
                    jsonCloseType: 'submitted',
                    jsonFieldName: 'close_description',
                    jsonTextTypeFieldName: 'close_description_text_type'
                });
            });
        });

        describe('Description', function() {
            setupFieldTests({
                supportsRichText: true,
                jsonFieldName: 'description',
                selector: '#field_description'
            });

            hasEditorTest();
            richTextSavingTest();

            describe('Formatting', function() {
                it('Links', function() {
                    reviewRequest.draft.set('description', 'Testing /r/123');

                    expect($field.text()).toBe('Testing /r/123');
                    expect($field.find('a').attr('href')).toBe('/r/123/');
                });
            });

            editCountTests();
        });

        describe('Summary', function() {
            setupFieldTests({
                jsonFieldName: 'summary',
                selector: '#field_summary'
            });

            hasEditorTest();
            savingTest();
            editCountTests();
        });

        describe('Testing Done', function() {
            setupFieldTests({
                supportsRichText: true,
                jsonFieldName: 'testing_done',
                selector: '#field_testing_done'
            });

            hasEditorTest();
            richTextSavingTest();

            describe('Formatting', function() {
                it('Links', function() {
                    reviewRequest.draft.set('testingDone', 'Testing /r/123');

                    expect($field.text()).toBe('Testing /r/123');
                    expect($field.find('a').attr('href')).toBe('/r/123/');
                });
            });

            editCountTests();
        });

        describe('Reviewers', function() {
            describe('Groups', function() {
                setupFieldTests({
                    jsonFieldName: 'target_groups',
                    selector: '#field_target_groups'
                });

                hasAutoCompleteTest();
                hasEditorTest();
                savingTest();

                it('Formatting', function() {
                    reviewRequest.draft.set('targetGroups', [
                        {
                            name: 'group1',
                            url: '/groups/group1/'
                        },
                        {
                            name: 'group2',
                            url: '/groups/group2/'
                        }
                    ]);

                    expect($field.html()).toBe(
                        '<a href="/groups/group1/">group1</a>, ' +
                        '<a href="/groups/group2/">group2</a>');
                });

                editCountTests();
            });

            describe('People', function() {
                setupFieldTests({
                    jsonFieldName: 'target_people',
                    selector: '#field_target_people'
                });

                hasAutoCompleteTest();
                hasEditorTest();
                savingTest();

                it('Formatting', function() {
                    reviewRequest.draft.set('targetPeople', [
                        {
                            username: 'user1',
                            url: '/users/user1/'
                        },
                        {
                            username: 'user2',
                            url: '/users/user2/'
                        }
                    ]);

                    expect($field.text()).toBe('user1, user2');
                    expect($($field.children()[0]).attr('href')).toBe('/users/user1/');
                    expect($($field.children()[1]).attr('href')).toBe('/users/user2/');
                });

                editCountTests();
            });
        });

        describe('Custom fields', function() {
            beforeEach(function() {
                saveSpyFunc = function(options, context) {
                    expect(options.data['extra_data.' + jsonFieldName])
                        .toBe('My Value');
                    options.success.call(context);
                };
            });

            setupFieldTests({
                fieldID: 'my_custom',
                jsonFieldName: 'my_custom',
                selector: '#field_my_custom',
                useExtraData: true
            });

            hasEditorTest();
            savingTest();
            editCountTests();
        });
    });

    describe('File attachments', function() {
        it('Rendering when added', function() {
            spyOn(RB.FileAttachmentThumbnail.prototype, 'render')
                .andCallThrough();

            expect($filesContainer.find('.file-container').length).toBe(0);

            view.render();
            editor.createFileAttachment();

            expect(RB.FileAttachmentThumbnail.prototype.render)
                .toHaveBeenCalled();
            expect($filesContainer.find('.file-container').length).toBe(1);
        });

        describe('Importing on render', function() {
            it('No file attachments', function() {
                view.render();

                expect(editor.fileAttachments.length).toBe(0);
            });

            describe('With file attachments', function() {
                var $thumbnail,
                    fileAttachment;

                beforeEach(function() {
                    $thumbnail = $('<div/>')
                        .addClass(
                            RB.FileAttachmentThumbnail.prototype.className)
                        .data('file-id', 42)
                        .html(RB.FileAttachmentThumbnail.prototype.template(
                            {
                                downloadURL: '',
                                iconURL: '',
                                deleteImageURL: '',
                                filename: '',
                                caption: '',
                                deleteFileText: 'Delete File',
                                noCaptionText: 'No caption'
                            }))
                        .appendTo($filesContainer);

                    spyOn(RB.FileAttachmentThumbnail.prototype, 'render')
                        .andCallThrough();

                    expect($filesContainer.find('.file-container').length)
                        .toBe(1);
                });

                it('Without caption', function() {
                    view.render();

                    expect(RB.FileAttachmentThumbnail.prototype.render)
                        .toHaveBeenCalled();
                    expect(editor.fileAttachments.length).toBe(1);

                    fileAttachment = editor.fileAttachments.at(0);
                    expect(fileAttachment.id).toBe(42);
                    expect(fileAttachment.get('caption')).toBe(null);
                    expect($filesContainer.find('.file-container').length)
                        .toBe(1);
                });

                it('With caption', function() {
                    $thumbnail.find('.file-caption .edit')
                        .removeClass('empty-caption')
                        .text('my caption');

                    view.render();

                    expect(RB.FileAttachmentThumbnail.prototype.render)
                        .toHaveBeenCalled();
                    expect(editor.fileAttachments.length).toBe(1);

                    fileAttachment = editor.fileAttachments.at(0);
                    expect(fileAttachment.id).toBe(42);
                    expect(fileAttachment.get('caption')).toBe('my caption');
                    expect($filesContainer.find('.file-container').length)
                        .toBe(1);
                });
            });
        });

        describe('Events', function() {
            var $thumbnail,
                fileAttachment;

            beforeEach(function() {
                view.render();
                fileAttachment = editor.createFileAttachment();

                $thumbnail = $($filesContainer.find('.file-container')[0]);
                expect($thumbnail.length).toBe(1);
            });

            describe('beginEdit', function() {
                it('Increment edit count', function() {
                    expect(editor.get('editCount')).toBe(0);

                    $thumbnail.find('.file-caption .edit')
                        .inlineEditor('startEdit');

                    expect(editor.get('editCount')).toBe(1);
                });
            });

            describe('endEdit', function() {
                describe('Decrement edit count', function() {
                    var $caption;

                    beforeEach(function() {
                        expect(editor.get('editCount')).toBe(0);

                        $caption = $thumbnail.find('.file-caption .edit')
                            .inlineEditor('startEdit');
                    });

                    it('On cancel', function() {
                        $caption.inlineEditor('cancel');
                        expect(editor.get('editCount')).toBe(0);
                    });

                    it('On submit', function() {
                        spyOn(fileAttachment, 'ready')
                            .andCallFake(function(options, context) {
                                options.ready.call(context);
                            });
                        spyOn(fileAttachment, 'save');

                        $thumbnail.find('input')
                            .val('Foo')
                            .triggerHandler('keyup');

                        $caption.inlineEditor('submit');

                        expect(editor.get('editCount')).toBe(0);
                    });
                });
            });
        });
    });

    describe('Screenshots', function() {
        describe('Importing on render', function() {
            it('No screenshots', function() {
                view.render();

                expect(editor.screenshots.length).toBe(0);
            });

            it('With screenshots', function() {
                $screenshotsContainer.append(
                    screenshotThumbnailTemplate({
                        id: 42
                    }));

                spyOn(RB.ScreenshotThumbnail.prototype, 'render')
                    .andCallThrough();

                view.render();

                expect(RB.ScreenshotThumbnail.prototype.render)
                    .toHaveBeenCalled();
                expect(editor.screenshots.length).toBe(1);
                expect(editor.screenshots.at(0).id).toBe(42);
            });
        });

        describe('Events', function() {
            var $thumbnail,
                screenshot;

            beforeEach(function() {
                $thumbnail = $(screenshotThumbnailTemplate({
                        id: 42
                    }))
                    .appendTo($screenshotsContainer);

                view.render();

                screenshot = editor.screenshots.at(0);
            });

            describe('beginEdit', function() {
                it('Increment edit count', function() {
                    expect(editor.get('editCount')).toBe(0);

                    $thumbnail.find('.screenshot-caption .edit')
                        .inlineEditor('startEdit');

                    expect(editor.get('editCount')).toBe(1);
                });
            });

            describe('endEdit', function() {
                describe('Decrement edit count', function() {
                    var $caption;

                    beforeEach(function() {
                        expect(editor.get('editCount')).toBe(0);

                        $caption = $thumbnail.find('.screenshot-caption .edit')
                            .inlineEditor('startEdit');
                    });

                    it('On cancel', function() {
                        $caption.inlineEditor('cancel');
                        expect(editor.get('editCount')).toBe(0);
                    });

                    it('On submit', function() {
                        spyOn(screenshot, 'ready')
                            .andCallFake(function(options, context) {
                                options.ready.call(context);
                            });
                        spyOn(screenshot, 'save');

                        $thumbnail.find('input')
                            .val('Foo')
                            .triggerHandler('keyup');

                        $caption.inlineEditor('submit');

                        expect(editor.get('editCount')).toBe(0);
                    });
                });
            });
        });
    });
});
